import { useEffect, useState } from "react";
import { fetchPhotoContexts, type PhotoContext } from "../../api/mediaApi";

export function useInspectionPhotoLinks(headstoneId: string, editInspectionId?: string) {
  const [linkedPhotos, setLinkedPhotos] = useState<{key:string; links?:PhotoContext[]; error?:string}>();
  const [photoCountRetry, setPhotoCountRetry] = useState(0);
  const photoCountKey = `${headstoneId}/${editInspectionId}/${photoCountRetry}`;
  useEffect(() => {
    if (!editInspectionId) return;
    const controller = new AbortController();
    void fetchPhotoContexts(headstoneId, controller.signal).then(links => {
      if (!controller.signal.aborted) setLinkedPhotos({key:photoCountKey, links:links.filter(link => link.inspectionId === editInspectionId)});
    }).catch(() => {
      if (!controller.signal.aborted) setLinkedPhotos({key:photoCountKey, error:"Linked photo counts could not be loaded."});
    });
    return () => controller.abort();
  }, [headstoneId, editInspectionId, photoCountKey]);
  const photoCountsReady = linkedPhotos?.key === photoCountKey;
  const photoCountsError = photoCountsReady ? linkedPhotos.error : undefined;
  const existingPhotoLinks = photoCountsReady ? linkedPhotos.links ?? [] : [];
  return { photoCountsReady, photoCountsError, existingPhotoLinks, setPhotoCountRetry };
}
