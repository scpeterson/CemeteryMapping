import { useState } from "react";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { formatDate } from "../../lib/format";
import type { OverviewImage } from "./overviewImages";
import { Modal } from "../ui/Modal";

function Photo({ image, count }: { image: OverviewImage; count: number }) {
  const { url, failed, error, retry, reportImageFailure, attempt } = useMediaUrl(image.url);
  const [expanded, setExpanded] = useState(false);
  return <figure className="overview-photo">
    {failed ? <div role="alert"><p>Photo couldn't be loaded. {error}</p><button type="button" onClick={retry}>Retry photo</button></div> : url ? <>
      <button type="button" className="overview-photo-open" aria-label={image.isPrimary ? "Open primary photo" : "Open latest photo"} onClick={() => setExpanded(true)}>
        <img src={url} alt={image.label} key={`${image.url}-${attempt}`} onError={reportImageFailure} />
      </button>
      {expanded ? <Modal className="overview-photo-dialog" label={image.isPrimary ? "Primary feature photo" : "Latest feature photo"} onClose={() => setExpanded(false)}>
        <button type="button" onClick={() => setExpanded(false)}>Close photo</button>
        <img src={url} alt={image.label} onError={reportImageFailure} />
      </Modal> : null}
    </> : <p role="status">Loading photo…</p>}
    <figcaption>
      <span>{image.linkedMarker ? `Photo of linked marker ${image.linkedMarker}` : image.isPrimary ? "Primary photo" : "Latest photo"}</span>
      {image.date ? <span>{formatDate(image.date)}</span> : null}
      <span>{count} photo{count === 1 ? "" : "s"} available</span>
    </figcaption>
  </figure>;
}

export function OverviewPhoto({ images }: { images: OverviewImage[] }) {
  return images.length ? <Photo key={images[0].url} image={images[0]} count={images.length} />
    : <p className="overview-no-photo">No photo available.</p>;
}
