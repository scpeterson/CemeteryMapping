import { editableMarkerFaces, isEmptyNewMarkerFace } from "../../lib/markerFaces";
import { MarkerFacesEditor, MarkerFacesView } from "./MarkerFaces";
import { LookupForm, LookupSelect, LookupSaveButton } from "./EditingOptions";
import { useId } from "react";
import { useDraftState } from "../../hooks/useDraftState";
import { Info, Pencil } from "lucide-react";
import { FormEvent, useState } from "react";
import { formatDate } from "../../lib/format";
import type {
  GraveFeature,
  GraveSpace,
  Headstone,
  HeadstoneLookups,
  LookupOption,
  MediaAsset,
  SaveGraveFeatureInput,
  SaveHeadstoneInput
} from "../../types";
import { GraveFeatureList } from "./GraveFeatureRecords";
import { MediaGallery, PhotoUploadForm } from "./MediaRecords";
import { NorthHillsEvidenceList } from "./NorthHillsEvidenceList";
import { ReviewBadgeGroup } from "./RecordReview";
import { dataConfidenceOptions, reviewStatusOptions } from "./reviewOptions";

const headstoneRelationshipCopy: Record<string, { label: string; description: string }> = {
  primary: {
    label: "Primary marker for this gravesite",
    description: "This is the normal marker relationship: the marker belongs primarily to this gravesite.",
  },
  spans: {
    label: "Marker spans multiple gravesites",
    description: "One physical marker or headstone is shared by this gravesite and at least one neighboring gravesite, such as a two-person headstone centered between burial spaces.",
  },
  nearby: {
    label: "Marker is nearby",
    description: "The marker is near this gravesite, but the exact relationship is not confirmed.",
  },
  inferred: {
    label: "Marker relationship inferred",
    description: "The marker relationship was inferred from imported records, location, or other available evidence and may need field confirmation.",
  },
  footstone: {
    label: "Footstone for this gravesite",
    description: "A smaller secondary marker is placed at the foot of this gravesite.",
  },
  secondary: {
    label: "Secondary marker for this gravesite",
    description: "A second marker belongs to this gravesite, separate from the primary headstone or monument.",
  },
};

function headstoneRelationshipDetails(relationshipType: string) {
  return (
    headstoneRelationshipCopy[relationshipType] ?? {
      label: `Marker relationship: ${relationshipType}`,
      description: "This marker has a non-standard relationship to the selected gravesite.",
    }
  );
}

function blankHeadstoneForm(headstone: Headstone, markerTypeOptions?: LookupOption[], cemeteryName = ""): SaveHeadstoneInput {
  const markerTypeId = markerTypeOptions?.some((option) => option.id === headstone.markerType.id) ? headstone.markerType.id : (markerTypeOptions?.[0]?.id ?? headstone.markerType.id);
  const isTrinity = cemeteryName === "Trinity Lutheran Church Cemetery";

  return {
    markerTypeId,
    markerScopeId: headstone.markerScope.id,
    materialId: headstone.material.id,
    conditionId: headstone.condition.id,
    vaseTypeId: headstone.vaseType?.id ?? "",
    vaseMaterialId: headstone.vaseMaterial?.id ?? "",
    vasePlacementId: headstone.vasePlacement?.id ?? "",
    vaseNotes: headstone.vaseNotes ?? "",
    conditionNotes: headstone.conditionNotes ?? "",
    inscription: headstone.inscription ?? "",
    faces: editableMarkerFaces(headstone),
    facesRevision: headstone.facesRevision ?? 0,
    designNotes: headstone.designNotes ?? "",
    backDescription: headstone.backDescription ?? "",
    photoUrl: headstone.photoUrl ?? "",
    lastInspectedAt: headstone.lastInspectedAt ?? "",
    dataConfidence: headstone.dataConfidence ?? "unknown",
    reviewStatus: headstone.reviewStatus ?? "unreviewed",
    reviewNotes: headstone.reviewNotes ?? "",
    sourceConflict: headstone.sourceConflict ?? false,
    nhgInclusion: !headstone.nhgInclusionRecorded && isTrinity ? "listed" : (headstone.nhgInclusion ?? "not_checked"),
    provenanceVerificationSource: headstone.provenanceVerificationSource ?? "manual_review",
    provenanceVerifiedAt: headstone.provenanceVerifiedAt ?? "",
    applyNhgInclusionToBurials: false,
    reason: "Headstone detail update",
  };
}

export function HeadstoneRecord({
  headstone,
  lookups,
  canUpdate,
  onSave,
  grave,
  cemeteryName,
  sectionName,
  canDeletePhotos,
  canReorderPhotos,
  onDeletePhoto,
  onMovePhoto,
  canUploadPhotos,
  onUploadPhoto,
  onUpdateGraveFeature,
  onDeleteGraveFeature,
  canDeleteGraveFeatures,
}: {
  headstone: Headstone;
  lookups: HeadstoneLookups;
  canUpdate: boolean;
  onSave: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  grave?: GraveSpace;
  cemeteryName: string;
  sectionName: string;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later" | "primary" | "automatic") => Promise<void>;
  canUploadPhotos: boolean;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
  onUpdateGraveFeature: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onDeleteGraveFeature: (id: string, reason?: string) => Promise<void>;
  canDeleteGraveFeatures: boolean;
}) {
  const isSectionG = sectionName.toUpperCase() === "G";
  const markerTypeOptions = isSectionG ? lookups.markerTypes.filter((option) => option.code === "flat_marker") : lookups.markerTypes;
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useDraftState<SaveHeadstoneInput>(() => blankHeadstoneForm(headstone, markerTypeOptions, cemeteryName));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const errorId = useId();
  const [provenanceMessage, setProvenanceMessage] = useState<string>();

  const startEditing = () => {
    setForm(blankHeadstoneForm(headstone, markerTypeOptions, cemeteryName));
    setError(undefined);
    setProvenanceMessage(undefined);
    setIsEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(undefined);
    try {
      const saved = await onSave(headstone.id, {
        ...form,
        faces: form.faces?.filter((face) => !isEmptyNewMarkerFace(face, headstone)),
      });
      setForm(blankHeadstoneForm(saved, markerTypeOptions, cemeteryName));
      if (saved.burialNhgPropagation) {
        const { updated, skipped } = saved.burialNhgPropagation;
        setProvenanceMessage(
          `${updated} associated burial${updated === 1 ? "" : "s"} updated.${skipped ? ` ${skipped} skipped because linked NHG evidence was preserved.` : ""}`,
        );
      }
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save headstone.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <LookupForm className="headstone-record headstone-form" onSubmit={(event) => void save(event)}>
        <div className="headstone-record-header">
          <strong>{headstone.headstoneId}</strong>
        </div>
        <label>
          Marker type
          <LookupSelect value={form.markerTypeId} onChange={(event) => setForm((current) => ({ ...current, markerTypeId: event.target.value }))}>
            {markerTypeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        {isSectionG ? <p className="muted headstone-wide-field">Section G allows only flat markers.</p> : null}
        <label>
          Marker scope
          <LookupSelect value={form.markerScopeId} onChange={(event) => setForm((current) => ({ ...current, markerScopeId: event.target.value }))}>
            {lookups.markerScopes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label>
          Material
          <LookupSelect value={form.materialId} onChange={(event) => setForm((current) => ({ ...current, materialId: event.target.value }))}>
            {lookups.materials.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label>
          Condition
          <LookupSelect value={form.conditionId} onChange={(event) => setForm((current) => ({ ...current, conditionId: event.target.value }))}>
            {lookups.conditions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label>
          Vase type
          <LookupSelect value={form.vaseTypeId} onChange={(event) => setForm((current) => ({ ...current, vaseTypeId: event.target.value }))}>
            <option value="">Not recorded</option>
            {lookups.vaseTypes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label>
          Vase material
          <LookupSelect value={form.vaseMaterialId} onChange={(event) => setForm((current) => ({ ...current, vaseMaterialId: event.target.value }))}>
            <option value="">Not recorded</option>
            {lookups.vaseMaterials.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label>
          Vase placement
          <LookupSelect value={form.vasePlacementId} onChange={(event) => setForm((current) => ({ ...current, vasePlacementId: event.target.value }))}>
            <option value="">Not recorded</option>
            {lookups.vasePlacements.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label>
          Last inspected
          <input type="date" value={form.lastInspectedAt} aria-invalid={error?.startsWith("Last inspected date") || undefined} aria-describedby={error?.startsWith("Last inspected date") ? errorId : undefined} onChange={(event) => setForm((current) => ({ ...current, lastInspectedAt: event.target.value }))} />
        </label>
        <label className="headstone-wide-field">
          Vase notes
          <textarea value={form.vaseNotes} onChange={(event) => setForm((current) => ({ ...current, vaseNotes: event.target.value }))} rows={2} />
        </label>
        <label className="headstone-wide-field">
          Condition notes
          <textarea value={form.conditionNotes} onChange={(event) => setForm((current) => ({ ...current, conditionNotes: event.target.value }))} rows={3} />
        </label>
        <MarkerFacesEditor headstone={headstone} faces={form.faces ?? []} disabled={isSaving}
          onChange={(faces) => setForm((current) => ({ ...current, faces }))} />
        <label className="headstone-wide-field">
          Flourishes or designs
          <textarea value={form.designNotes} onChange={(event) => setForm((current) => ({ ...current, designNotes: event.target.value }))} rows={3} />
        </label>
        <label className="headstone-wide-field">
          Back of stone
          <textarea value={form.backDescription} onChange={(event) => setForm((current) => ({ ...current, backDescription: event.target.value }))} rows={3} />
        </label>
        <label>
          Data confidence
          <LookupSelect value={form.dataConfidence} onChange={(event) => setForm((current) => ({ ...current, dataConfidence: event.target.value as SaveHeadstoneInput["dataConfidence"] }))}>
            {dataConfidenceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label>
          Review status
          <LookupSelect value={form.reviewStatus} onChange={(event) => setForm((current) => ({ ...current, reviewStatus: event.target.value as SaveHeadstoneInput["reviewStatus"] }))}>
            {reviewStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label>
          NHG inclusion
          <LookupSelect value={form.nhgInclusion} onChange={(event) => setForm((current) => ({ ...current, nhgInclusion: event.target.value as SaveHeadstoneInput["nhgInclusion"] }))}>
            <option value="not_checked">Not yet checked</option>
            <option value="listed">Listed in NHG</option>
            <option value="not_listed">Not listed in NHG</option>
            <option value="unclear">Unclear</option>
          </LookupSelect>
        </label>
        <label>
          Verification source
          <LookupSelect
            value={form.provenanceVerificationSource}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                provenanceVerificationSource: event.target.value as SaveHeadstoneInput["provenanceVerificationSource"],
              }))
            }
          >
            <option value="field_survey">Field survey</option>
            <option value="field_photo">Field photo review</option>
            <option value="documentary_record">Documentary record</option>
            <option value="manual_review">Manual review</option>
            <option value="import">Imported source</option>
          </LookupSelect>
        </label>
        <label>
          Source information verified on
          <input
            type="date"
            value={form.provenanceVerifiedAt} aria-invalid={error?.startsWith("Source information verified date") || undefined} aria-describedby={error?.startsWith("Source information verified date") ? errorId : undefined}
            onChange={(event) => setForm((current) => ({ ...current, provenanceVerifiedAt: event.target.value }))}
          />
        </label>
        <label className="headstone-checkbox-field headstone-wide-field">
          <input
            type="checkbox"
            checked={form.applyNhgInclusionToBurials}
            onChange={(event) => setForm((current) => ({ ...current, applyNhgInclusionToBurials: event.target.checked }))}
          />
          Apply this NHG inclusion status to associated burials
        </label>
        <p className="muted headstone-wide-field">
          Burials with genuine linked NHG evidence are preserved and skipped.
        </p>
        <label className="headstone-checkbox-field">
          <input type="checkbox" checked={form.sourceConflict} onChange={(event) => setForm((current) => ({ ...current, sourceConflict: event.target.checked }))} />
          Source conflict
        </label>
        <label className="headstone-wide-field">
          Review notes
          <textarea value={form.reviewNotes} onChange={(event) => setForm((current) => ({ ...current, reviewNotes: event.target.value }))} rows={3} />
        </label>
        {error ? <p id={errorId} className="detail-message is-error" role="alert">{error}</p> : null}
        <div className="headstone-form-actions">
          <button type="button" className="secondary-button" onClick={() => setIsEditing(false)} disabled={isSaving}>
            Cancel
          </button>
          <LookupSaveButton type="submit" disabled={isSaving || !form.markerTypeId || !form.markerScopeId || !form.materialId || !form.conditionId || markerTypeOptions.length === 0}>
            {isSaving ? "Saving..." : "Save marker"}
          </LookupSaveButton>
        </div>
      </LookupForm>
    );
  }

  const assignedPhotoIds = new Set((headstone.faces ?? []).flatMap((face) => face.mediaAssetIds));
  const unassignedPhotos = (headstone.mediaAssets ?? []).filter((asset) => !assignedPhotoIds.has(asset.id));
  const relationshipDetails = headstoneRelationshipDetails(headstone.relationshipType);
  const relationshipTitle = headstone.relationshipNotes ? `${relationshipDetails.description} Notes: ${headstone.relationshipNotes}` : relationshipDetails.description;

  return (
    <article className="headstone-record">
      <div className="headstone-record-header">
        <strong>{headstone.headstoneId}</strong>
        {canUpdate ? (
          <button type="button" className="icon-text-button" onClick={startEditing} aria-label={`Edit marker ${headstone.headstoneId}`}>
            <Pencil size={14} aria-hidden="true" />
            Edit
          </button>
        ) : null}
      </div>
      <dl>
        <div>
          <dt>Type</dt>
          <dd>{headstone.markerType.label}</dd>
        </div>
        <div>
          <dt>Scope</dt>
          <dd>{headstone.markerScope.label}</dd>
        </div>
        <div>
          <dt>Material</dt>
          <dd>{headstone.material.label}</dd>
        </div>
        <div>
          <dt>Condition</dt>
          <dd>{headstone.condition.label}</dd>
        </div>
        {headstone.vaseType ? (
          <div>
            <dt>Vase</dt>
            <dd>{headstone.vaseType.label}</dd>
          </div>
        ) : null}
        {headstone.vaseMaterial ? (
          <div>
            <dt>Vase material</dt>
            <dd>{headstone.vaseMaterial.label}</dd>
          </div>
        ) : null}
        {headstone.vasePlacement ? (
          <div>
            <dt>Vase placement</dt>
            <dd>{headstone.vasePlacement.label}</dd>
          </div>
        ) : null}
        <div>
          <dt>Last inspected</dt>
          <dd>{formatDate(headstone.lastInspectedAt)}</dd>
        </div>
        <div>
          <dt>NHG inclusion</dt>
          <dd>
            {headstone.nhgInclusion === "listed"
              ? "Listed in NHG"
              : headstone.nhgInclusion === "not_listed"
                ? "Not listed in NHG"
                : headstone.nhgInclusion === "unclear"
                  ? "Unclear"
                  : "Not yet checked"}
          </dd>
        </div>
      </dl>
      {headstone.vaseNotes ? <p className="note-box">Vase: {headstone.vaseNotes}</p> : null}
      {headstone.conditionNotes ? <p className="note-box">{headstone.conditionNotes}</p> : null}
      <ReviewBadgeGroup dataConfidence={headstone.dataConfidence} reviewStatus={headstone.reviewStatus} sourceConflict={headstone.sourceConflict} reviewNotes={headstone.reviewNotes} />
      {provenanceMessage ? <p className="detail-message is-success" role="status">{provenanceMessage}</p> : null}
      <MarkerFacesView headstone={headstone} canDelete={canDeletePhotos} onDelete={onDeletePhoto} onMove={canReorderPhotos ? onMovePhoto : undefined} />
      {headstone.designNotes ? <p className="note-box">Designs: {headstone.designNotes}</p> : null}
      {headstone.backDescription ? <p className="note-box">Back: {headstone.backDescription}</p> : null}
      {headstone.features?.length ? (
        <GraveFeatureList
          features={headstone.features}
          canUpdate={canUpdate}
          canDelete={canDeleteGraveFeatures}
          grave={grave}
          fixedHeadstone={headstone}
          lookups={lookups}
          onUpdate={onUpdateGraveFeature}
          onDelete={onDeleteGraveFeature}
        />
      ) : null}
      {unassignedPhotos.length ? (
        <MediaGallery assets={unassignedPhotos} canDelete={canDeletePhotos} onDelete={onDeletePhoto} onMove={canReorderPhotos ? onMovePhoto : undefined} />
      ) : null}
      {canUploadPhotos ? <PhotoUploadForm headstones={[headstone]} fixedHeadstone={headstone} onUpload={onUploadPhoto} /> : null}
      {headstone.relationshipType !== "primary" || headstone.relationshipNotes ? (
        <p className="marker-relationship" title={relationshipTitle} aria-label={relationshipTitle}>
          <Info size={14} aria-hidden="true" />
          <span>
            {relationshipDetails.label} <span className="marker-relationship-code">({headstone.relationshipType})</span>
            {headstone.relationshipNotes ? ` - ${headstone.relationshipNotes}` : ""}
          </span>
        </p>
      ) : null}
      <NorthHillsEvidenceList evidence={headstone.northHillsEvidence ?? []} />
    </article>
  );
}
