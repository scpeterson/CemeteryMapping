import type { MediaAsset } from "../types";

export function sortedMediaAssets(assets: MediaAsset[]) {
  return [...assets].sort((left, right) => {
    const leftDate = Date.parse(left.capturedAt ?? left.uploadedAt ?? "");
    const rightDate = Date.parse(right.capturedAt ?? right.uploadedAt ?? "");
    const dateDifference = (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
    if (dateDifference !== 0) return dateDifference;
    const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}
