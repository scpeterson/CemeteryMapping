import type { MarkerDetailAction } from "./markerWorkflowTypes";
import { editableMarkerFaces, isEmptyNewMarkerFace } from "../../lib/markerFaces";
import { MarkerFacesEditor, MarkerFacesView } from "./MarkerFaces";
import { LookupForm, LookupSelect, LookupSaveButton } from "./EditingOptions";
import { lazy, Suspense, useId } from "react";
import { useDraftState } from "../../hooks/useDraftState";
import { Info, Pencil } from "lucide-react";
import { FormEvent, useState, useRef, useEffect, type ReactNode, type ComponentProps } from "react";
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
import { MaintenanceRecordForm, MaintenanceRecordList } from "./MaintenanceRecords";
import { GraveFeatureList } from "./GraveFeatureRecords";
import { useContext } from "react";
import { PhotoGalleryContext } from "./photoGalleryContext";
import { NorthHillsEvidenceList } from "./NorthHillsEvidenceList";
import { ReviewBadgeGroup } from "./RecordReview";
import { dataConfidenceOptions, reviewStatusOptions } from "./reviewOptions";

const MonumentInspections = lazy(() => import("./MonumentInspections").then(module => ({default:module.MonumentInspections})));

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
    newInspections: [],
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
    currentLegibility: headstone.currentLegibility,
    historicalTranscriptions: headstone.historicalTranscriptions,
    faces: editableMarkerFaces(headstone),
    facesRevision: headstone.facesRevision ?? 0,
    designNotes: headstone.designNotes ?? "",
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
  canEditInspections,
  onSave,
  grave,
  cemeteryName,
  sectionName,
  canDeletePhotos,
  onDeletePhoto,
  onUploadPhoto,
  onUpdateGraveFeature,
  onDeleteGraveFeature,
  canDeleteGraveFeatures,
  markerInformationContent,
  initialAction,
  onInitialActionHandled,
  onSaveMaintenanceRecord,
  onUpdateMaintenanceRecord,
}: {
  initialAction?: MarkerDetailAction;
  onInitialActionHandled?: () => void;
  markerInformationContent?: ReactNode;
  onSaveMaintenanceRecord?: ComponentProps<typeof MaintenanceRecordForm>["onSave"];
  onUpdateMaintenanceRecord?: ComponentProps<typeof MaintenanceRecordList>["onUpdate"];
  headstone: Headstone;
  lookups: HeadstoneLookups;
  canUpdate: boolean;
  canEditInspections: boolean;
  onSave: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  grave?: GraveSpace;
  cemeteryName: string;
  sectionName: string;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later" | "primary" | "automatic") => Promise<void>;
  canUploadPhotos: boolean;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string; inspectionId?: string; maintenanceRecordId?: string; faceId?: string; phase?: "unspecified" | "before" | "during" | "after" }) => Promise<void>;
  onUpdateGraveFeature: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onDeleteGraveFeature: (id: string, reason?: string) => Promise<void>;
  canDeleteGraveFeatures: boolean;
}) {
  const { open: openPhotos } = useContext(PhotoGalleryContext);
  const isSectionG = sectionName.toUpperCase() === "G";
  const markerTypeOptions = isSectionG ? lookups.markerTypes.filter((option) => option.code === "flat_marker") : lookups.markerTypes;
  const [isEditing, setIsEditing] = useState(initialAction === "edit-information" && canUpdate);
  const [editArea, setEditArea] = useState<"information" | "faces" | "review">("information");
  const [form, setForm] = useDraftState<SaveHeadstoneInput>(() => blankHeadstoneForm(headstone, markerTypeOptions, cemeteryName));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const errorId = useId();
  const sectionPrefix = useId();
  const sectionNavRef = useRef<HTMLElement>(null);
  const [currentSection,setCurrentSection] = useState("inspections");
  useEffect(()=>{
    const nav=sectionNavRef.current;
    const panel=nav?.closest(".detail-panel");
    const tabs=panel?.querySelector<HTMLElement>(".detail-tabs");
    if(!nav || !tabs || !panel) return;
    let frame=0;
    const track=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const sections=Array.from(nav.parentElement?.querySelectorAll<HTMLElement>(":scope > [data-marker-section]")??[]);
        const line=nav.getBoundingClientRect().bottom+64;
        let current=sections[0];
        for(const section of sections){
          if(section.getBoundingClientRect().top<=line) current=section;
        }
        const last=sections.at(-1);
        if(last && panel.scrollHeight-panel.scrollTop-panel.clientHeight<=2 && last.getBoundingClientRect().top<panel.getBoundingClientRect().bottom) current=last;
        if(current?.dataset.markerSection) setCurrentSection(current.dataset.markerSection);
      });
    };
    const update=()=>{
      const top=Math.max(0,tabs.getBoundingClientRect().height+(parseFloat(getComputedStyle(tabs).top)||0));
      nav.parentElement?.style.setProperty("--marker-section-nav-top",`${top}px`);
      const padding=parseFloat(getComputedStyle(panel).paddingTop)||0;
      nav.parentElement?.style.setProperty("--marker-section-scroll-margin",`${top+nav.getBoundingClientRect().height+padding+12}px`);
      track();
    };
    const observer=new ResizeObserver(update);
    observer.observe(tabs);observer.observe(nav);observer.observe(panel);
    if(nav.parentElement) observer.observe(nav.parentElement);
    panel.addEventListener("scroll",track,{passive:true});update();
    return ()=>{observer.disconnect();panel.removeEventListener("scroll",track);cancelAnimationFrame(frame);};
  },[isEditing]);
  const sections = [{id:"inspections",label:"Inspections"},{id:"photos",label:"Photos"},{id:"maintenance",label:"Maintenance"},{id:"information",label:"Marker information"},{id:"review",label:"Sources & review"}];
  const editorRef = useRef<HTMLFormElement>(null);
  const maintenanceRef = useRef<HTMLDetailsElement>(null);
  const launched = useRef(false);
  useEffect(()=>{
    if(!initialAction || initialAction === "new-inspection" || launched.current)return;
    if(initialAction === "edit-information" && canUpdate && editorRef.current){
      launched.current=true;
      editorRef.current.scrollIntoView({block:"start"});
      editorRef.current.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")?.focus({preventScroll:true});
    } else if(initialAction === "new-maintenance" && canUpdate && maintenanceRef.current){
      launched.current=true;
      maintenanceRef.current.open=true;
      maintenanceRef.current.scrollIntoView({block:"start"});
      maintenanceRef.current.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")?.focus({preventScroll:true});
    } else if(initialAction === "view-inspections"){
      launched.current=true;
      const heading=document.getElementById(`${sectionPrefix}-inspections`);
      heading?.focus({preventScroll:true});heading?.scrollIntoView({block:"start"});
    }
    if(launched.current)onInitialActionHandled?.();
  },[initialAction,canUpdate,lookups,sectionPrefix,onInitialActionHandled]);
  const [returnFocus,setReturnFocus] = useState<"information"|"review"|null>(null);
  useEffect(()=>{
    if(isEditing || !returnFocus)return;
    const heading=document.getElementById(`${sectionPrefix}-${returnFocus}`);
    if(!heading)return;
    heading.focus({preventScroll:true});heading.scrollIntoView({block:"start"});
    setReturnFocus(null);
  },[isEditing,returnFocus,sectionPrefix]);
  const finishEditing = () => {
    setReturnFocus(editArea === "review" ? "review" : "information");
    setIsEditing(false);
  };
  const [provenanceMessage, setProvenanceMessage] = useState<string>();

  const startEditing = (area: "information" | "faces" | "review" = "information") => {
    setEditArea(area);
    setForm(blankHeadstoneForm(headstone, markerTypeOptions, cemeteryName));
    setError(undefined);
    setProvenanceMessage(undefined);
    setIsEditing(true);
    requestAnimationFrame(()=>{editorRef.current?.scrollIntoView({block:"start"});editorRef.current?.querySelector<HTMLElement>("input, select, textarea")?.focus({preventScroll:true});});
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
      finishEditing();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save headstone.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <LookupForm ref={editorRef} className="headstone-record headstone-form" onSubmit={(event) => void save(event)}>
        <div className="headstone-record-header">
          <strong>{headstone.headstoneId} · {editArea === "information" ? "Edit marker information" : editArea === "faces" ? "Edit face records" : "Edit sources & review"}</strong>
        </div>
        {editArea === "information" ? <>
        <p className="muted headstone-wide-field">Update physical marker information. Use New inspection to record condition, readings, and visit photos.</p>
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
        <label className="headstone-wide-field">
          Vase notes
          <textarea value={form.vaseNotes} onChange={(event) => setForm((current) => ({ ...current, vaseNotes: event.target.value }))} rows={2} />
        </label>
        <label className="headstone-wide-field">
          Flourishes or designs
          <textarea value={form.designNotes} onChange={(event) => setForm((current) => ({ ...current, designNotes: event.target.value }))} rows={3} />
        </label>
        </> : null}
        {editArea === "faces" ? <>
        <p className="muted headstone-wide-field">Maintain marker face records and their people and photo associations. Record visit-specific readings under Inspections.</p>
        <MarkerFacesEditor headstone={headstone} faces={form.faces ?? []} disabled={isSaving || !canEditInspections}
          onChange={(faces) => setForm((current) => ({ ...current, faces }))} />
        </> : null}
        {editArea === "review" ? <>
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
        </> : null}
        {error ? <p id={errorId} className="detail-message is-error" role="alert">{error}</p> : null}
        <div className="headstone-form-actions">
          <button type="button" className="secondary-button" onClick={finishEditing} disabled={isSaving}>
            Cancel
          </button>
          <LookupSaveButton type="submit" disabled={isSaving || !form.markerTypeId || !form.markerScopeId || !form.materialId || !form.conditionId || markerTypeOptions.length === 0}>
            {isSaving ? "Saving..." : "Save marker"}
          </LookupSaveButton>
        </div>
      </LookupForm>
    );
  }

  const sharedMarker = headstone.spansMultipleGravesites || headstone.relationshipType === "spans";
  const relationshipDetails = headstoneRelationshipDetails(sharedMarker ? "spans" : headstone.relationshipType);
  const relationshipTitle = headstone.relationshipNotes ? `${relationshipDetails.description} Notes: ${headstone.relationshipNotes}` : relationshipDetails.description;

  return (
    <article className="headstone-record marker-workflow">
      <div className="headstone-record-header"><strong>{headstone.headstoneId}</strong></div>
      <nav className="marker-section-nav" ref={sectionNavRef} aria-label={`Sections for marker ${headstone.headstoneId}`}>
        <label>Jump to section<select value={currentSection} onChange={event=>{
          setCurrentSection(event.target.value);
          const heading=document.getElementById(`${sectionPrefix}-${event.target.value}`);
          heading?.focus({preventScroll:true});heading?.scrollIntoView({block:"start"});
        }}>
          {sections.map(section=><option key={section.id} value={section.id}>{section.label}</option>)}
        </select></label>
      </nav>
      <section className="marker-workflow-section" data-marker-section="inspections">
        <h3 id={`${sectionPrefix}-inspections`} tabIndex={-1}>Inspections</h3>
        <p className="muted">Dated observations of condition, inscriptions, and supporting photos.</p>
        {!headstone.inspections?.length ? <div className="note-box"><strong>Earlier marker condition:</strong> {headstone.condition.label} · Last inspected: {formatDate(headstone.lastInspectedAt)}{headstone.conditionNotes ? <p>{headstone.conditionNotes}</p> : null}<p className="muted">No dated inspection has been recorded yet.</p></div> : null}
      <Suspense fallback={<p role="status">Loading inspections…</p>}><MonumentInspections key={headstone.id} onStarted={onInitialActionHandled} startNew={initialAction === "new-inspection"} showHeading={false} headstone={headstone} conditions={lookups.conditions} onUploadPhoto={canEditInspections ? onUploadPhoto : undefined}
        onSave={canEditInspections ? async (entry, updating) => {
          const saved = await onSave(headstone.id, { ...blankHeadstoneForm(headstone, markerTypeOptions, cemeteryName),
            inspectionChangesOnly: true, newInspections: updating ? [] : [entry], updatedInspections: updating ? [entry] : [] });
          return saved;
        } : undefined} /></Suspense>
      </section>
      <section className="marker-workflow-section" data-marker-section="photos">
        <h3 id={`${sectionPrefix}-photos`} tabIndex={-1}>Photos</h3>
        <p className="muted">One gallery for marker, inspection, and maintenance photos. Filter by record, face, or timing.</p>
      <div className="all-monument-photos">
        <button type="button" onClick={() => openPhotos({headstone})}>Photo gallery ({headstone.mediaAssets?.filter(asset => asset.assetType === "photo").length ?? 0})</button>
      </div>
      </section>
      <section className="marker-workflow-section" data-marker-section="maintenance">
        <h3 id={`${sectionPrefix}-maintenance`} tabIndex={-1}>Maintenance</h3>
        <p className="muted">Issues, planned work, completed actions, and their photo evidence.</p>
        <MaintenanceRecordList records={headstone.maintenanceRecords ?? []} canUpdate={canUpdate} fixedHeadstone={headstone} grave={grave} lookups={lookups} onUpdate={onUpdateMaintenanceRecord} onUploadPhoto={onUploadPhoto} />
        {canUpdate && onSaveMaintenanceRecord && lookups.maintenancePriorities.length && (lookups.maintenanceIssueTypes.length || lookups.maintenanceActionTypes.length) ? <details ref={maintenanceRef} className="marker-add-maintenance"><summary>Add maintenance record</summary><MaintenanceRecordForm fixedHeadstone={headstone} lookups={lookups} onSave={onSaveMaintenanceRecord} /></details> : null}
      </section>
      <section className="marker-workflow-section" data-marker-section="information">
        <h3 id={`${sectionPrefix}-information`} tabIndex={-1}>Marker information</h3>
        <p className="muted">Physical attributes, face records, features, and related markers or gravesites.</p>
      {canUpdate ? <button type="button" className="icon-text-button" data-discard-draft onClick={() => startEditing()} aria-label={`Edit marker information ${headstone.headstoneId}`}><Pencil size={14} aria-hidden="true" />Edit marker information</button> : null}
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

      </dl>
      {headstone.vaseNotes ? <p className="note-box">Vase: {headstone.vaseNotes}</p> : null}
        {canUpdate && canEditInspections ? <button type="button" className="icon-text-button" data-discard-draft onClick={() => startEditing("faces")}>Edit face records</button> : null}
      {headstone.inspections?.length ? <details>
        <summary>Face records and transcription history</summary>
      <MarkerFacesView headstone={headstone} canDelete={canDeletePhotos} onDelete={onDeletePhoto} />
      </details> : <MarkerFacesView headstone={headstone} canDelete={canDeletePhotos} onDelete={onDeletePhoto} />}
      {headstone.designNotes ? <p className="note-box">Designs: {headstone.designNotes}</p> : null}
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
      {sharedMarker || headstone.relationshipType !== "primary" || headstone.relationshipNotes ? (
        <p className="marker-relationship" title={relationshipTitle} aria-label={relationshipTitle}>
          <Info size={14} aria-hidden="true" />
          <span>
            {relationshipDetails.label}{!sharedMarker ? <> <span className="marker-relationship-code">({headstone.relationshipType})</span></> : null}
            {headstone.relationshipNotes ? ` - ${headstone.relationshipNotes}` : ""}
          </span>
        </p>
      ) : null}
        {markerInformationContent}
      </section>
      <section className="marker-workflow-section" data-marker-section="review">
        <h3 id={`${sectionPrefix}-review`} tabIndex={-1}>Sources &amp; review</h3>
        <p className="muted">Source evidence, verification, confidence, and unresolved concerns.</p>
        {canUpdate ? <button type="button" className="icon-text-button" data-discard-draft onClick={() => startEditing("review")}>Edit sources &amp; review</button> : null}
        <dl>
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
          <div><dt>Data confidence</dt><dd>{dataConfidenceOptions.find(option=>option.value===headstone.dataConfidence)?.label ?? "Unknown"}</dd></div>
          <div><dt>Review status</dt><dd>{reviewStatusOptions.find(option=>option.value===headstone.reviewStatus)?.label ?? "Unreviewed"}</dd></div>
          <div><dt>Verification source</dt><dd>{({field_survey:"Field survey",field_photo:"Field photo review",documentary_record:"Documentary record",manual_review:"Manual review",import:"Imported source"})[headstone.provenanceVerificationSource ?? "manual_review"]}</dd></div>
          <div><dt>Verified on</dt><dd>{formatDate(headstone.provenanceVerifiedAt)}</dd></div>
        </dl>
        <ReviewBadgeGroup dataConfidence={headstone.dataConfidence} reviewStatus={headstone.reviewStatus} sourceConflict={headstone.sourceConflict} reviewNotes={headstone.reviewNotes} />
        {provenanceMessage ? <p className="detail-message is-success" role="status">{provenanceMessage}</p> : null}
        {headstone.northHillsEvidence?.length ? <NorthHillsEvidenceList evidence={headstone.northHillsEvidence} /> : <p className="muted">No NHG source evidence is linked to this marker.</p>}
      </section>
    </article>
  );
}
