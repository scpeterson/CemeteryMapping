import type { ReactNode } from "react";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import type { MediaAsset } from "../../types";

export function MediaPhoto({ asset, children }: { asset: MediaAsset; children: ReactNode }) {
  const { url, failed } = useMediaUrl(asset.fileUrl);
  return (
    <a className="media-gallery-item" href={url} target="_blank" rel="noreferrer">
      {url ? <img src={url} alt={asset.notes || asset.originalFilename || "Cemetery record photo"} loading="lazy" />
        : <span>{failed ? "Photo unavailable" : "Loading photo…"}</span>}
      {children}
    </a>
  );
}
