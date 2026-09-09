import { sortedMediaAssets } from "../../lib/media";
import { Modal } from "../ui/Modal";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { Camera, Star, Trash2, X } from "lucide-react";
import { MediaPhoto } from "./MediaPhoto";
import { formatDate } from "../../lib/format";
import type { Headstone, MediaAsset } from "../../types";

const galleryPreviewLimit = 4;

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
  onMove?: (asset: MediaAsset, direction: "earlier" | "later" | "primary" | "automatic") => Promise<void>;
}) {
  const sortedAssets = sortedMediaAssets(assets);
  const previewAssets = sortedAssets.slice(0, galleryPreviewLimit);
  const [isShowingAll, setIsShowingAll] = useState(false);
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

  const moveAsset = async (asset: MediaAsset, direction: "earlier" | "later" | "primary" | "automatic") => {
    if (!onMove) return;
    setMovingId(asset.id);
    setError(undefined);
    try {
      await onMove(asset, direction);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Unable to change primary photo.");
    } finally {
      setMovingId(undefined);
    }
  };

  const gallery = (visibleAssets: MediaAsset[], expanded: boolean) => (
    <div className={`media-gallery${expanded ? " media-gallery-expanded" : ""}`}>
      {visibleAssets.map((asset) => {
        return (
          <div key={asset.id} className="media-gallery-card">
            <MediaPhoto asset={asset}>
              <span>{asset.capturedAt ? `Date taken: ${formatDate(asset.capturedAt)}` : `Uploaded: ${formatDate(asset.uploadedAt)}`}</span>
            </MediaPhoto>
            {asset.isPrimary ? <span className="media-primary-label"><Star size={14} aria-hidden="true" /> Primary photo</span> : null}
            {onMove && asset.mediaLinkId ? (
              <button type="button" className="media-primary-button"
                onClick={() => void moveAsset(asset, asset.isPrimary ? "automatic" : "primary")}
                disabled={Boolean(movingId)}
                aria-label={`${asset.isPrimary ? "Remove primary" : "Make primary"}: ${asset.originalFilename || asset.id}`}>
                {movingId === asset.id ? "Saving…" : asset.isPrimary ? "Remove primary" : "Make primary"}
              </button>
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
        );
      })}
    </div>
  );

  return (
    <>
      {gallery(previewAssets, false)}
      {sortedAssets.length > galleryPreviewLimit ? (
        <button type="button" className="media-gallery-view-all" onClick={() => setIsShowingAll(true)}>
          View all photos ({sortedAssets.length})
        </button>
      ) : null}
      {isShowingAll ? (
        <Modal className="media-gallery-modal" label="All photos" onClose={() => setIsShowingAll(false)}>
            <header>
              <div>
                <h3 id="media-gallery-modal-title">All photos</h3>
                <p>{sortedAssets.length} photos, {sortedAssets.some((asset) => asset.isPrimary) ? "primary first, then newest first" : "newest first"}</p>
              </div>
              <button type="button" className="media-gallery-modal-close" onClick={() => setIsShowingAll(false)} aria-label="Close all photos">
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            {gallery(sortedAssets, true)}
        </Modal>
      ) : null}
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
