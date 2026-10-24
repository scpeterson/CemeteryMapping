import { sortedMediaAssets } from "../../lib/media";
import { Modal } from "../ui/Modal";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
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
  showAll = false,
  renderDetails,
  renderActions,
  photoActionMenu = false,
}: {
  assets: MediaAsset[];
  photoActionMenu?: boolean;
  showAll?: boolean;
  renderDetails?: (asset: MediaAsset) => ReactNode;
  renderActions?: (asset: MediaAsset) => ReactNode;
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

  const PhotoActions = photoActionMenu ? "details" : "div";
  const gallery = (visibleAssets: MediaAsset[], expanded: boolean) => (
    <div className={`media-gallery${expanded ? " media-gallery-expanded" : ""}`}>
      {visibleAssets.map((asset) => {
        return (
          <div key={asset.id} className="media-gallery-card">
            <MediaPhoto asset={asset}>
              {asset.originalFilename ? <span className="media-photo-filename">{asset.originalFilename}</span> : null}
              <span>{asset.capturedAt ? `Date taken: ${formatDate(asset.capturedAt)}` : `Uploaded: ${formatDate(asset.uploadedAt)}`}</span>
            </MediaPhoto>
            {renderDetails?.(asset)}
            {renderActions?.(asset)}
            {asset.isPrimary ? <span className="media-primary-label"><Star size={14} aria-hidden="true" /> Primary photo</span> : null}
            {(onMove && asset.mediaLinkId || canDelete && onDelete) ? <PhotoActions className={photoActionMenu ? "photo-card-menu" : undefined}>
            {photoActionMenu ? <summary aria-label={`Photo actions: ${asset.originalFilename || asset.id}`}>Photo actions</summary> : null}
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
                <Trash2 size={14} aria-hidden="true" />{photoActionMenu ? "Delete photo" : null}
              </button>
            ) : null}
            </PhotoActions> : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {gallery(showAll ? sortedAssets : previewAssets, showAll)}
      {!showAll && sortedAssets.length > galleryPreviewLimit ? (
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
      {error ? <p className="detail-message is-error" role="alert">{error}</p> : null}
    </>
  );
}

export function PhotoUploadForm({
  fixedHeadstone,
  photoContext,
  onPendingChange,
  onBusyChange,
  onUpload,
}: {
  fixedHeadstone: Headstone;
  onPendingChange?: (pending: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  photoContext?: { inspectionId?: string; maintenanceRecordId?: string; faceId?: string; phase?: "unspecified" | "before" | "during" | "after" };
  onUpload: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string; inspectionId?: string; maintenanceRecordId?: string; faceId?: string; phase?: "unspecified" | "before" | "during" | "after" }) => Promise<void>;
}) {
  const [phase, setPhase] = useState<"unspecified" | "before" | "during" | "after">("unspecified");
  const [files, setFiles] = useState<File[]>([]);
  const [capturedAt, setCapturedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [results, setResults] = useState<{ name: string; status: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  useEffect(()=>{onPendingChange?.(Boolean(files.length||notes||capturedAt));},[files,notes,capturedAt,onPendingChange]);
  useEffect(()=>{onBusyChange?.(isSaving);},[isSaving,onBusyChange]);

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles=Array.from(event.target.files ?? []);
    if(selectedFiles.some(file=>file.size>25*1024*1024)){
      setError("Each photo must be 25 MB or smaller.");event.target.value="";return;
    }
    setFiles(selectedFiles);
    setResults([]);
    setMessage(undefined);
    setError(undefined);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!files.length || uploading.current) return;
    uploading.current = true;
    setIsSaving(true);
    setError(undefined);
    setMessage(undefined);
    const queue = files;
    const failed: File[] = [];
    const nextResults = queue.map(file => ({ name: file.name, status: "Waiting" }));
    setResults([...nextResults]);
    try {
      for (const [index, file] of queue.entries()) {
        nextResults[index] = { name: file.name, status: "Uploading" };
        setResults([...nextResults]);
        setMessage(`Uploading ${index + 1} of ${queue.length}…`);
        try {
          await onUpload({ file, ...photoContext, phase: photoContext?.phase ?? phase, headstoneId: fixedHeadstone.id, notes, capturedAt: capturedAt || undefined });
          nextResults[index] = { name: file.name, status: "Uploaded" };
        } catch (uploadError) {
          failed.push(file);
          nextResults[index] = { name: file.name, status: uploadError instanceof Error ? uploadError.message : "Unable to upload photo." };
        }
        setResults([...nextResults]);
      }
      setFiles(failed);
      if (fileInput.current) fileInput.current.value = "";
      const uploaded = queue.length - failed.length;
      setMessage(queue.length === 1 && uploaded === 1 ? "Photo uploaded and linked." : `${uploaded} of ${queue.length} photos uploaded and linked.`);
      if (failed.length) {
        setError(`${failed.length} photo${failed.length === 1 ? "" : "s"} failed. Retry uploads only the failed photos.`);
      } else {
        setCapturedAt("");
        setNotes("");
      }
    } finally {
      uploading.current = false;
      setIsSaving(false);
    }
  };

  return (
    <form className="photo-upload-form" onSubmit={(event) => void submit(event)}>
      <label>
        Choose photos to upload
        <input ref={fileInput} type="file" accept="image/*" multiple disabled={isSaving} onChange={chooseFile} />
      </label>
      <div className="photo-upload-linked-marker">
        <span>Linked monument</span>
        <strong>{fixedHeadstone.headstoneId}</strong>
      </div>
      {photoContext?.maintenanceRecordId && photoContext.phase === undefined ? <label>Maintenance timing<select value={phase} disabled={isSaving} onChange={(event) => setPhase(event.target.value as typeof phase)}>
        <option value="unspecified">Not recorded</option><option value="before">Before maintenance</option><option value="during">During maintenance</option><option value="after">After maintenance</option>
      </select></label> : null}
      <label>
        Date taken
        <input type="date" disabled={isSaving} value={capturedAt} onChange={(event) => setCapturedAt(event.target.value)} />
      </label>
      <label className="headstone-wide-field">
        Notes
        <textarea disabled={isSaving} value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
      </label>
      <p className="muted">Select one or more photos. The marker, date, and notes apply to all selected photos; leave the date blank to use each photo’s available date metadata.</p>
      {files.length && !isSaving && !results.length ? <p>{files.length} photo{files.length === 1 ? "" : "s"} selected: {files.map(file => file.name).join(", ")}</p> : null}
      {results.length ? <ul aria-label="Photo upload results">{results.map((result, index) => <li key={index}>{result.name}: {result.status}</li>)}</ul> : null}
      {message ? <p className="detail-message is-success" role="status">{message}</p> : null}
      {error ? <p className="detail-message is-error" role="alert">{error}</p> : null}
      <button type="submit" disabled={!files.length || isSaving}>
        <Camera size={15} aria-hidden="true" />
        {isSaving ? "Uploading..." : error && files.length ? "Retry failed photos" : files.length > 1 ? "Upload photos" : "Upload photo"}
      </button>
    </form>
  );
}
