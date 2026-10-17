import { useState, type ReactNode } from "react";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { useNearViewport } from "../../hooks/useNearViewport";
import { Modal } from "../ui/Modal";
import { FullPhoto } from "./FullPhoto";
import type { MediaAsset } from "../../types";

export function MediaPhoto({ asset, children }: { asset: MediaAsset; children: ReactNode }) {
  const { ref, active } = useNearViewport();
  const [expanded, setExpanded] = useState(false);
  const label = asset.notes || asset.originalFilename || "Cemetery record photo";
  const { url, failed, error, retry, reportImageFailure, attempt } = useMediaUrl(asset.thumbnailUrl || asset.fileUrl, active);
  return (
    <div className="media-gallery-item" ref={ref}>
      {failed ? <div role="alert"><p>Photo couldn't be loaded. {error}</p><button type="button" onClick={retry}>Retry photo</button></div>
        : url ? <a href={url} aria-label={`Open photo: ${label}`} onClick={(event) => { event.preventDefault(); setExpanded(true); }}><img key={`${asset.fileUrl}-${attempt}`} src={url} onError={reportImageFailure} alt={label} loading="lazy" /></a>
        : <span role="status">Loading photo…</span>}
      {expanded ? <Modal className="overview-photo-dialog" label="Record photo" onClose={() => setExpanded(false)}>
        <button type="button" onClick={() => setExpanded(false)}>Close photo</button>
        <FullPhoto fileUrl={asset.fileUrl} label={label} />
      </Modal> : null}
      {children}
    </div>
  );
}
