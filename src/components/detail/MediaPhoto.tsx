import type { ReactNode } from "react";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import type { MediaAsset } from "../../types";

export function MediaPhoto({ asset, children }: { asset: MediaAsset; children: ReactNode }) {
  const { url, failed, error, retry, reportImageFailure, attempt } = useMediaUrl(asset.fileUrl);
  return (
    <div className="media-gallery-item">
      {failed ? <div role="alert"><p>Photo couldn't be loaded. {error}</p><button type="button" onClick={retry}>Retry photo</button></div>
        : url ? <a href={url} target="_blank" rel="noreferrer"><img key={`${asset.fileUrl}-${attempt}`} src={url} onError={reportImageFailure} alt={asset.notes || asset.originalFilename || "Cemetery record photo"} loading="lazy" /></a>
        : <span role="status">Loading photo…</span>}
      {children}
    </div>
  );
}
