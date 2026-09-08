import { useState } from "react";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { formatDate } from "../../lib/format";
import type { OverviewImage } from "./overviewImages";
import { Modal } from "../ui/Modal";

function Photo({ image, count }: { image: OverviewImage; count: number }) {
  const { url, failed } = useMediaUrl(image.url);
  const [imageFailed, setImageFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  return <figure className="overview-photo">
    {failed || imageFailed ? <p>Photo unavailable.</p> : url ? <>
      <button type="button" className="overview-photo-open" aria-label="Open latest photo" onClick={() => setExpanded(true)}>
        <img src={url} alt={image.label} onError={() => setImageFailed(true)} />
      </button>
      {expanded ? <Modal className="overview-photo-dialog" label="Latest feature photo" onClose={() => setExpanded(false)}>
        <button type="button" onClick={() => setExpanded(false)}>Close photo</button>
        <img src={url} alt={image.label} />
      </Modal> : null}
    </> : <p role="status">Loading photo…</p>}
    <figcaption>
      <span>{image.linkedMarker ? `Photo of linked marker ${image.linkedMarker}` : "Latest photo"}</span>
      {image.date ? <span>{formatDate(image.date)}</span> : null}
      <span>{count} photo{count === 1 ? "" : "s"} available</span>
    </figcaption>
  </figure>;
}

export function OverviewPhoto({ images }: { images: OverviewImage[] }) {
  return images.length ? <Photo key={images[0].url} image={images[0]} count={images.length} />
    : <p className="overview-no-photo">No photo available.</p>;
}
