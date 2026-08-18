import { type ChangeEvent, type FormEvent, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { apiBaseUrl } from "../../config/environment";
import { formatDate } from "../../lib/format";
import type { Headstone, MediaAsset } from "../../types";

function mediaUrl(asset: MediaAsset) {
  if (/^https?:\/\//u.test(asset.fileUrl)) return asset.fileUrl;
  if (/^https?:\/\//u.test(apiBaseUrl)) return `${new URL(apiBaseUrl).origin}${asset.fileUrl}`;
  return asset.fileUrl;
}

function sortedMediaAssets(assets: MediaAsset[]) {
  return [...assets].sort((left, right) => {
    const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    const leftDate = Date.parse(left.capturedAt ?? left.uploadedAt ?? "");
    const rightDate = Date.parse(right.capturedAt ?? right.uploadedAt ?? "");
    return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
  });
}

export function MediaGallery({
  assets,
  emptyMessage = "No photos are linked yet.",
  canDelete = false,
  onDelete,
  onMove,
}: {
  assets: MediaAsset[];
  emptyMessage?: string;
  canDelete?: boolean;
  onDelete?: (assetId: string, reason?: string) => Promise<void>;
  onMove?: (asset: MediaAsset, direction: "earlier" | "later") => Promise<void>;
}) {
  const sortedAssets = sortedMediaAssets(assets);
  const [deletingId, setDeletingId] = useState<string>();
  const [movingId, setMovingId] = useState<string>();
  const [error, setError] = useState<string>();
  if (!sortedAssets.length) return <p className="muted">{emptyMessage}</p>;

  const deleteAsset = async (asset: MediaAsset) => {
    if (!onDelete) return;
    const reason = window.prompt("Reason for deleting this photo?", "Replacing incorrect photo");
    if (reason === null) return;
    setDeletingId(asset.id);
    setError(undefined);
    try {
      await onDelete(asset.id, reason);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete photo.");
    } finally {
      setDeletingId(undefined);
    }
  };

  const moveAsset = async (asset: MediaAsset, direction: "earlier" | "later") => {
    if (!onMove) return;
    setMovingId(asset.id);
    setError(undefined);
    try {
      await onMove(asset, direction);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Unable to reorder photo.");
    } finally {
      setMovingId(undefined);
    }
  };

  return (
    <>
      <div className="media-gallery">
        {sortedAssets.map((asset, index) => (
          <div key={asset.id} className="media-gallery-card">
            <a className="media-gallery-item" href={mediaUrl(asset)} target="_blank" rel="noreferrer">
              <img src={mediaUrl(asset)} alt={asset.notes || asset.originalFilename || "Cemetery record photo"} loading="lazy" />
              <span>{asset.capturedAt ? `Date taken: ${formatDate(asset.capturedAt)}` : `Uploaded: ${formatDate(asset.uploadedAt)}`}</span>
            </a>
            {onMove && sortedAssets.length > 1 ? (
              <div className="media-order-controls" aria-label="Photo display order">
                <button
                  type="button"
                  onClick={() => void moveAsset(asset, "earlier")}
                  disabled={index === 0 || movingId === asset.id}
                  aria-label="Move photo earlier"
                  title="Move photo earlier"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => void moveAsset(asset, "later")}
                  disabled={index === sortedAssets.length - 1 || movingId === asset.id}
                  aria-label="Move photo later"
                  title="Move photo later"
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            ) : null}
            {canDelete && onDelete ? (
              <button
                type="button"
                className="media-delete-button"
                onClick={() => void deleteAsset(asset)}
                disabled={deletingId === asset.id}
                aria-label={`Delete photo ${asset.originalFilename || asset.id}`}
                title="Delete photo"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {error ? <p className="detail-message is-error">{error}</p> : null}
    </>
  );
}

export function PhotoUploadForm({
  headstones,
  fixedHeadstone,
  gravesiteOnly = false,
  onUpload,
}: {
  headstones: Headstone[];
  fixedHeadstone?: Headstone;
  gravesiteOnly?: boolean;
  onUpload: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
}) {
  const [file, setFile] = useState<File>();
  const [headstoneId, setHeadstoneId] = useState(fixedHeadstone?.id ?? "");
  const [capturedAt, setCapturedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0]);
    setMessage(undefined);
    setError(undefined);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) return;
    setIsSaving(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await onUpload({ file, headstoneId: fixedHeadstone?.id ?? (headstoneId || undefined), notes, capturedAt: capturedAt || undefined });
      setFile(undefined);
      setHeadstoneId(fixedHeadstone?.id ?? "");
      setCapturedAt("");
      setNotes("");
      setMessage("Photo uploaded and linked.");
      form.reset();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload photo.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="photo-upload-form" onSubmit={(event) => void submit(event)}>
      <label>
        Photo
        <input type="file" accept="image/*" capture="environment" onChange={chooseFile} />
      </label>
      {fixedHeadstone ? (
        <div className="photo-upload-linked-marker">
          <span>Linked marker</span>
          <strong>{fixedHeadstone.headstoneId}</strong>
        </div>
      ) : gravesiteOnly ? (
        <div className="photo-upload-linked-marker">
          <span>Linked record</span>
          <strong>Gravesite overview</strong>
        </div>
      ) : (
        <label>
          Link marker
          <select value={headstoneId} onChange={(event) => setHeadstoneId(event.target.value)}>
            <option value="">Gravesite overview</option>
            {headstones.map((headstone) => (
              <option key={headstone.id} value={headstone.id}>
                {headstone.headstoneId}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Date taken
        <input type="date" value={capturedAt} onChange={(event) => setCapturedAt(event.target.value)} />
      </label>
      <label className="headstone-wide-field">
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
      </label>
      {message ? <p className="detail-message is-success">{message}</p> : null}
      {error ? <p className="detail-message is-error">{error}</p> : null}
      <button type="submit" disabled={!file || isSaving}>
        <Camera size={15} aria-hidden="true" />
        {isSaving ? "Uploading..." : "Upload photo"}
      </button>
    </form>
  );
}
