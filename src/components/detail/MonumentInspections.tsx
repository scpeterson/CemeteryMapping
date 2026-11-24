import { InscriptionFields } from "./InscriptionFields";
import { InspectionFaceReading, InspectionReading } from "./InspectionFaceReading";
import { combinedInspectionReading as combinedReading, isCombinedInspectionReading as isCombined, inspectionDraftReading } from "../../lib/inspectionReadings";
import { saveInspectionDraft } from "../../lib/saveInspectionDraft";
import { useAccountSession } from "../../auth/sessionContext";
import { sortedMonumentInspections, inspectionTypeLabels } from "../../lib/monumentInspections";
import { inspectionFacePhotos } from "../../lib/inspectionPhotos";
import { PhotoGalleryContext } from "./photoGalleryContext";
import { RecordPhotos } from "./RecordPhotos";
import type { ComponentProps } from "react";
import { lazy, Suspense, useContext, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { requiredVisitLabels, useInspectionReviewNavigation } from "./useInspectionReviewNavigation";
import { useInspectionDraft } from "./useInspectionDraft";
import { useInspectionDisplayPreferences } from "./useInspectionDisplayPreferences";
import { useInspectionPhotoLinks } from "./useInspectionPhotoLinks";
import { InspectionDisplaySettings } from "./InspectionDisplaySettings";
import type { Headstone, InspectionInput, InspectionFace, LookupOption } from "../../types";
import { formatDate } from "../../lib/format";

const InspectionFacePhotos = lazy(() => import("./InspectionFacePhotos").then(module => ({default:module.InspectionFacePhotos})));

const InspectionFacePhotoReview = lazy(() => import("./InspectionFacePhotos").then(module => ({default:module.InspectionFacePhotoReview})));

const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

type MonumentInspectionsProps = {
  onDelete?: (entry: {id: string; expectedUpdatedAt: string}) => Promise<Headstone>;
  onStarted?: () => void;
  startNew?: boolean;
  showHeading?: boolean;
  headstone: Headstone;
  conditions?: LookupOption[];
  onUploadPhoto?: ComponentProps<typeof RecordPhotos>["onUpload"];
  onSave?: (entry: InspectionInput, updating: boolean) => Promise<Headstone>;
};

export function MonumentInspections(props: MonumentInspectionsProps) {
  const account = useAccountSession();
  return <InspectionEditor key={`${account?.accountId ?? account?.identity ?? "local"}/${props.headstone.id}`} {...props} />;
}

function InspectionEditor({ headstone, conditions = [], onSave, onDelete, onUploadPhoto, showHeading = true, startNew = false, onStarted }: MonumentInspectionsProps) {
  const { recovery, setRecovery, recoveryUnavailable, clearRecovery, draft, setDraft, updating, setUpdating,
    step, setStep, activeFaceId, setActiveFaceId } = useInspectionDraft(headstone.id);
  const {open:openPhotoGallery}=useContext(PhotoGalleryContext);
  const inspections = sortedMonumentInspections(headstone.inspections);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = inspections.find((entry) => entry.id === selectedId) ?? inspections[0];
  const [saving, setSaving] = useState(false);
  const [savedNotice,setSavedNotice] = useState(false);
  const missingPhotoFiles = (draft?.photos??[]).filter(photo=>!photo.saved && photo.missingFileName && !photo.file);

  const editInspectionId = updating && draft && !draft.recordSaved ? draft.id : undefined;
  const { photoCountsReady, photoCountsError, existingPhotoLinks, setPhotoCountRetry } = useInspectionPhotoLinks(headstone.id, editInspectionId);
  const steps = ["Visit & condition", "Faces & photos", "Review & save"];
  const requirementsId = useId();
  const {
    displayPreferencesReset, setDisplayPreferencesReset, remainingItemsOpen,
    correctionCollapsed, setCorrectionCollapsed, remainingItemsControl, keyboardHelpControl,
    resetKeyboardHelpControl, restoredDefaultsControl, restoredDisplayDefaults,
    displayResetButton, displayResetNotice, pendingItemListFocusRef,
    dismissDisplayReset, resetDisplayPreferences,
  } = useInspectionDisplayPreferences();
  const {
    activeFace, missingVisitFields, missingFaces, missingRequiredCount, missingItems,
    currentCorrectionKey, currentCorrectionIndex, correctionStatus, correctingRequired, showCorrectionPanel,
    correctionPanel, requiredItemButtons, requiredSummaryHeading, requiredVisitInputs, visitTypeInput,
    reviewVisitButton, faceLabelInputs, reviewEditButtons, setStageHeading,
    editingFromReview, goToStep, editVisit, editFace, navigateToStep, advanceStep,
    selectMissingItem, moveMissingItem, handleRemainingItemsKey, handleRequiredItemKey, requestStepFocus,
  } = useInspectionReviewNavigation({
    draft, updating, step, setStep, activeFaceId, setActiveFaceId,
    correctionCollapsed, setCorrectionCollapsed, remainingItemsControl, pendingItemListFocusRef,
  });
  const [error, setError] = useState<string>();
  const change = (value: Partial<InspectionInput>) => setDraft((current) => current ? { ...current, ...value } : current);

  const changeFaces = (faces: InspectionFace[]) => {
    if (!draft) return;
    change({faces,...(isCombined(draft.inscription,draft.faces) ? {inscription:combinedReading(faces)} : {})});
  };

  const begin = (edit: boolean) => {
    setSavedNotice(false);
    setDisplayPreferencesReset(false);
    setCorrectionCollapsed(!remainingItemsOpen);
    setError(undefined);
    setUpdating(edit);
    setActiveFaceId(undefined);
    setPhotoCountRetry(current => current + 1);
    goToStep(0);
    setDraft(() => edit && selected ? {
      id: selected.id, inspectedAt: selected.inspectedAt ?? "", inspectionYear: selected.inspectionYear,
      sourceType: selected.sourceType, source: selected.source, conditionId: selected.conditionId,
      conditionNotes: selected.conditionNotes, expectedUpdatedAt: selected.updatedAt,
      ...inspectionDraftReading(selected.inscription, selected.faces),
    } : {
      id: crypto.randomUUID(), inspectedAt: localToday(), sourceType: "field_survey",
      source: "Cemetery administrator field inspection",
      conditionId: conditions.find((c) => c.code === "unknown")?.id ?? "",
      conditionNotes: "",
      ...inspectionDraftReading(selected?.inscription ?? headstone.inscription ?? "", selected ? selected.faces : headstone.faces),
    });
  };
  const launchNew = useEffectEvent(()=>{if(!recovery)begin(false);});
  const launched = useRef(false);
  useEffect(()=>{
    if(startNew && onSave && !launched.current){launched.current=true;launchNew();onStarted?.();}
  },[startNew,onSave,onStarted]);
  const save = async () => {
    if (!draft || !onSave || missingRequiredCount || missingPhotoFiles.length) return;
    setSaving(true); setError(undefined);
    try {
      await saveInspectionDraft({
        draft,
        updating,
        headstone,
        saveInspection: onSave,
        uploadPhoto: onUploadPhoto,
        onInspectionSaved: () => {
          setSelectedId(draft.id);
          setDraft(current => current ? { ...current, recordSaved: true } : current);
        },
        onPhotoSaved: photoId => {
          setDraft(current => current ? {
            ...current,
            photos: current.photos?.map(photo => photo.id === photoId ? { ...photo, saved: true } : photo),
          } : current);
        },
      });
      setSelectedId(draft.id);
      clearRecovery();
      setDraft(null);
      setSavedNotice(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save inspection.");
    } finally { setSaving(false); }
  };

  return <section className="headstone-wide-field monument-inspections" aria-label="Inspections">
    {showHeading ? <h4>Inspections</h4> : null}
    {inspections.length ? <label>Inspection
      <select value={selected?.id ?? ""} disabled={Boolean(draft) || saving} onChange={(event) => setSelectedId(event.target.value)}>
        {inspections.map((entry) => <option key={entry.id} value={entry.id}>
          {entry.inspectedAt ? formatDate(entry.inspectedAt) : `${entry.inspectionYear} (exact date unknown)`} · {inspectionTypeLabels[entry.sourceType]} · {entry.source}
        </option>)}
      </select>
    </label> : <p className="muted">No inspections recorded.</p>}
    {selected && !draft ? <div aria-label="Selected inspection">
      <p><strong>Condition:</strong> {selected.condition}</p>
      {selected.conditionNotes ? <p className="note-box">{selected.conditionNotes}</p> : null}
      <p><strong>Source:</strong> {selected.source}</p>
      <InspectionReading inscription={selected.inscription} faces={selected.faces} />
    </div> : null}
    {selected && !draft ? <RecordPhotos key={selected.id} headstone={headstone} faces={selected.faces ?? []} inspectionId={selected.id} canUpdate={Boolean(onSave)} onUpload={onUploadPhoto} /> : null}
    {onSave && !draft && recovery ? <section className="inspection-recovery" aria-label="Saved inspection draft">
      <p><strong>Unfinished inspection available.</strong> Saved on this browser {formatDate(recovery.savedAt)}.</p>
      <button type="button" onClick={()=>{setUpdating(recovery.updating);setActiveFaceId(recovery.activeFaceId);setDraft(()=>recovery.draft);setStep(recovery.step);requestStepFocus();setRecovery(null);setSavedNotice(false);}}>Resume draft</button>
      <button type="button" className="secondary-button" onClick={()=>{if(window.confirm("Discard the saved inspection draft?"))clearRecovery();}}>Discard saved draft</button>
    </section> : null}
    {onSave && !draft && !recovery && !saving ? <div className="headstone-form-actions inspection-actions">
      <button type="button" onClick={() => begin(false)}>New inspection</button>
      {selected ? <button type="button" className="secondary-button" onClick={() => begin(true)}>Edit inspection</button> : null}
    </div> : null}
    {onDelete && selected?.updatedAt && !draft && !recovery ? <button type="button" className="secondary-button" disabled={saving} onClick={async () => {
      const expectedUpdatedAt = selected.updatedAt;
      if (!expectedUpdatedAt) return;
      if (!window.confirm(`Delete the inspection from ${selected.inspectedAt ? formatDate(selected.inspectedAt) : selected.inspectionYear} by ${selected.source}? Photos will stay in the marker gallery, but their links to this inspection will be removed.`)) return;
      setSaving(true); setError(undefined);
      try { await onDelete({id:selected.id,expectedUpdatedAt}); setSelectedId(undefined); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete inspection."); }
      finally { setSaving(false); }
    }}>{saving ? "Deleting inspection…" : "Delete inspection"}</button> : null}
    {!draft && error ? <p role="alert">{error}</p> : null}
    {draft && recoveryUnavailable ? <p role="alert">Browser draft recovery is unavailable. Keep this page open until you save.</p> : null}
    {draft && missingPhotoFiles.length ? <p className="inspection-recovery" role="alert">Reselect {missingPhotoFiles.length} photo files before saving, or remove them from the draft. Browser recovery retained their names and notes, but not the files.</p> : null}
    {draft || savedNotice ? <p className={`inspection-save-status${draft ? "" : " is-saved"}`} role="status" aria-label="Inspection save status" aria-live="polite" aria-atomic="true">
      {!draft ? "All changes saved." : saving ? (draft.recordSaved ? `Inspection saved — saving photos. ${(draft.photos??[]).filter(photo=>!photo.saved).length} remaining.` : "Saving inspection…")
        : draft.recordSaved ? ((draft.photos??[]).some(photo=>!photo.saved) ? `Inspection saved — ${(draft.photos??[]).filter(photo=>!photo.saved).length} photos need retry. Your inspection is safe.` : "All changes saved.") : "Unsaved changes."}
    </p> : null}
    {draft ? <fieldset className="inspection-editor" disabled={saving} onKeyDown={event=>{
      if(event.key!=="Escape" || !displayPreferencesReset || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();event.stopPropagation();dismissDisplayReset(true);
    }}>
      <legend>{updating ? "Edit inspection" : "New inspection"}</legend>
      {!updating && step === 1 ? <p className="muted">The inscription was copied from {selected ? "the selected inspection" : "the marker"}. Edit it or save it as-is. Photo links are not copied. Add photos under each face; they will be linked when you save.</p> : null}
      {draft.recordSaved?<div role="status">
        <p>Inspection saved. {(draft.photos ?? []).filter(photo => !photo.saved).length} photos need retry. Retry the remaining photos, or close to keep the inspection and photos already saved.</p>
        <ul>{(draft.photos??[]).map(photo=><li key={photo.id}>{photo.file?.name||photo.missingFileName||headstone.mediaAssets?.find(a=>a.id===photo.mediaAssetId)?.originalFilename||"Monument photo"}: {photo.saved?"Saved and linked":"Pending"}{!photo.saved?<button type="button" className="secondary-button" onClick={()=>setDraft(current=>current?{...current,photos:current.photos?.filter(p=>p.id!==photo.id)}:current)}>Remove pending photo</button>:null}</li>)}</ul>
      </div>:null}
      {draft.recordSaved && missingPhotoFiles.length ? <section aria-label="Reselect pending photo files">{missingPhotoFiles.map(photo=><label key={photo.id}>Reselect {photo.missingFileName}<input type="file" accept="image/*" onChange={event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>25*1024*1024){setError("Each photo must be 25 MB or smaller.");return;}setDraft(current=>current?{...current,photos:current.photos?.map(item=>item.id===photo.id?{...item,file,missingFileName:undefined}:item)}:current);}} /></label>)}</section> : null}
      {!draft.recordSaved ? <nav className="inspection-steps" aria-label="Inspection steps">
        {steps.map((label, index) => {
          const missing = [missingVisitFields.length, missingFaces.length, missingRequiredCount][index];
          const status = missing ? `${missing} required ${missing===1?"item":"items"} missing`
            : index===2 ? (step===2?"Ready to save":"Ready to review") : "Required info complete";
          return <button key={label} type="button" aria-label={`${index + 1}. ${label}`} aria-describedby={`${requirementsId}-step-${index}`}
            aria-current={step === index ? "step" : undefined} onClick={() => navigateToStep(index)}>
            <span className="inspection-step-label">{index + 1}. {label}</span>
            <span id={`${requirementsId}-step-${index}`} className={`inspection-step-status ${missing?"has-missing":"is-ready"}`}>
              <span aria-hidden="true">{missing?"!":"✓"}</span>{status}
            </span>
          </button>;
        })}
      </nav> : null}
      <fieldset disabled={Boolean(draft.recordSaved)} className="inspection-fields" hidden={Boolean(draft.recordSaved)}>
      <div className="inspection-stage" hidden={step !== 0}>
      <h5 tabIndex={-1} ref={element => setStageHeading(0, element)}>Visit &amp; condition</h5>
      <label>Inspection type<select ref={visitTypeInput} value={draft.sourceType} onChange={(e) => change({
        sourceType: e.target.value as InspectionInput["sourceType"],
        ...(e.target.value === "nhg" ? { inspectedAt: "2005-10-11", inspectionYear: 2005 } : {}),
      })}>
        <option value="field_survey">Field inspection</option><option value="nhg">NHG</option><option value="historical">Historical inspection</option>
      </select></label>
      <label>Inspection date<input ref={element=>{if(element)requiredVisitInputs.current.set("date",element);else requiredVisitInputs.current.delete("date");}} aria-required={!updating} aria-invalid={missingVisitFields.includes("date")||undefined} aria-describedby={missingVisitFields.includes("date")?`${requirementsId}-date`:undefined} type="date" value={draft.inspectedAt} disabled={draft.sourceType === "nhg"} onChange={(e) => change({ inspectedAt: e.target.value })} /></label>
      {updating && !draft.inspectedAt ? <p className="muted">Recorded year: {draft.inspectionYear}. Leave the date empty if the exact date is unknown.</p> : null}
      <label>Inspection source<input ref={element=>{if(element)requiredVisitInputs.current.set("source",element);else requiredVisitInputs.current.delete("source");}} aria-required="true" aria-invalid={missingVisitFields.includes("source")||undefined} aria-describedby={missingVisitFields.includes("source")?`${requirementsId}-source`:undefined} value={draft.source} maxLength={500} onChange={(e) => change({ source: e.target.value })} /></label>
      <label>Monument condition<select ref={element=>{if(element)requiredVisitInputs.current.set("condition",element);else requiredVisitInputs.current.delete("condition");}} aria-required="true" aria-invalid={missingVisitFields.includes("condition")||undefined} aria-describedby={missingVisitFields.includes("condition")?`${requirementsId}-condition`:undefined} value={draft.conditionId} onChange={(e) => change({ conditionId: e.target.value })}>
        <option value="">Choose condition</option>{conditions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select></label>
      <label>Monument condition notes<textarea value={draft.conditionNotes} maxLength={4000} rows={3} onChange={(e) => change({ conditionNotes: e.target.value })} /></label>
      </div>
      <div className="inspection-stage" hidden={step !== 1}>
      <h5 tabIndex={-1} ref={element => setStageHeading(1, element)}>Faces &amp; photos</h5>
      <p className="muted">Keep line breaks in each reading. Photos are optional and stay with this inspection.</p>
      {editInspectionId && photoCountsError ? <p role="alert" className="detail-message is-error">{photoCountsError} <button type="button" className="secondary-button" onClick={() => setPhotoCountRetry(current => current + 1)}>Retry linked photo counts</button></p> : null}
      <div className="inspection-face-cards" role="group" aria-label="Choose inspection face">
        {(draft.faces ?? []).map((face, index) => {
          const {selectedCount:photoCount,linkedCount}=inspectionFacePhotos(face.id,draft.photos??[],headstone.mediaAssets??[],existingPhotoLinks);
          const selectedLabel = `${photoCount} ${photoCount === 1 ? "photo" : "photos"} selected`;
          const photoLabel = !editInspectionId ? selectedLabel
            : !photoCountsReady ? `Loading linked photos · ${selectedLabel}`
            : photoCountsError ? `Linked photos unavailable · ${selectedLabel}`
            : `${linkedCount + photoCount} ${linkedCount + photoCount === 1 ? "photo" : "photos"} total · ${linkedCount} linked · ${photoCount} selected`;
          return <button key={face.id} type="button" aria-pressed={activeFace?.id === face.id}
            aria-controls={`inspection-face-${face.id}`} aria-describedby={`inspection-face-reading-${face.id} inspection-face-photos-${face.id}`} aria-label={`Select face ${index + 1}: ${face.label.trim() ? face.label : "Unlabeled face"}`}
            onClick={() => setActiveFaceId(face.id)}>
            <strong>{face.label.trim() ? face.label : `Face ${index + 1}: label required`}</strong>
            <span id={`inspection-face-reading-${face.id}`}>{face.inscription.trim() ? "Reading recorded" : face.inscriptionStatus === "blank" ? "Blank" : face.inscriptionStatus === "illegible" ? "Illegible" : "No reading recorded"}</span>
            <span id={`inspection-face-photos-${face.id}`}>{photoLabel}</span>
          </button>;
        })}
      </div>
      {(draft.faces ?? []).map((face,index) => <fieldset key={face.id} id={`inspection-face-${face.id}`} hidden={activeFace?.id !== face.id} aria-label={`Inspection face ${index+1}`}>
        <legend>Face {index+1}</legend>
        <label>Face label<input aria-required="true" aria-invalid={!face.label.trim()||undefined} aria-describedby={!face.label.trim()?`${requirementsId}-face-${face.id}`:undefined} ref={element=>{if(element)faceLabelInputs.current.set(face.id,element);else faceLabelInputs.current.delete(face.id);}} value={face.label} maxLength={100} onChange={e=>changeFaces(draft.faces!.map(f=>f.id===face.id?{...f,label:e.target.value}:f))} /></label>
        <InscriptionFields textLabel="Face inscription" text={face.inscription} status={face.inscriptionStatus}
          currentLegibility={face.currentLegibility} historicalTranscriptions={face.historicalTranscriptions}
          onChange={value=>changeFaces(draft.faces!.map(f=>f.id===face.id?{...f,...value}:f))} />
        <details><summary>Flourishes or designs</summary><label>Flourishes or designs<textarea value={face.designNotes??""} maxLength={20000} rows={3} onChange={e=>changeFaces(draft.faces!.map(f=>f.id===face.id?{...f,designNotes:e.target.value}:f))} /></label></details>
        {!draft.recordSaved?<Suspense fallback={<p role="status">Loading face photos…</p>}><InspectionFacePhotos canUpload={Boolean(onUploadPhoto)} faceId={face.id} photos={draft.photos??[]} assets={(headstone.mediaAssets??[]).filter(a=>a.assetType==="photo")}
          linkedPhotos={existingPhotoLinks} linkedLoading={Boolean(editInspectionId && !photoCountsReady)} linkedUnavailable={Boolean(photoCountsError)}
          onManageLinked={editInspectionId?()=>openPhotoGallery({headstone,inspectionId:editInspectionId,faceId:face.id,onClose:()=>setPhotoCountRetry(current=>current+1)}):undefined}
          onChange={photos=>setDraft(current=>current?{...current,photos}:current)} /></Suspense>:null}
      </fieldset>)}
      <button type="button" className="secondary-button" disabled={(draft.faces?.length ?? 0)>=32} onClick={()=>{
        const face = {id:crypto.randomUUID(),label:`Face ${(draft.faces?.length ?? 0)+1}`,inscription:""};
        changeFaces([...(draft.faces ?? []),face]);
        setActiveFaceId(face.id);
      }}>Add inspection face</button>
      {!isCombined(draft.inscription,draft.faces) ? <><p className="muted">Keep any reading whose face is unknown in the inspection inscription below.</p>
      <label>Inspection inscription<textarea value={draft.inscription} maxLength={20000} rows={5} onChange={(e) => change({ inscription: e.target.value })} /></label></> : <p className="muted">The combined inscription is kept in sync with these face readings.</p>}
      </div>
      <div className="inspection-stage" hidden={step !== 2}>
        <h5 tabIndex={-1} ref={element => setStageHeading(2, element)}>Review &amp; save</h5>
        <section className={`inspection-review-required${missingRequiredCount?" has-missing":""}`} aria-label="Required information">
          <h5 tabIndex={-1} ref={requiredSummaryHeading}>{missingRequiredCount ? `${missingRequiredCount} required ${missingRequiredCount===1?"item is":"items are"} missing` : "Required information complete"}</h5>
          {missingRequiredCount ? <><p>Complete these items before saving. Your draft stays intact while you make corrections.</p>
            <ul>{missingVisitFields.map(field=><li key={field}>
              <span id={`${requirementsId}-${field}`}>{field==="date"?"Inspection date is required.":field==="source"?"Inspection source is required.":"Monument condition is required."}</span>
              <button type="button" className="secondary-button" onClick={()=>editVisit(field)}>{field==="date"?"Add inspection date":field==="source"?"Add inspection source":"Choose condition"}</button>
            </li>)}{missingFaces.map(face=><li key={face.id}>
              <span id={`${requirementsId}-face-${face.id}`}>Face {face.number} needs a label.</span>
              <button type="button" className="secondary-button" onClick={()=>editFace(face.id,true)}>Label face {face.number}</button>
            </li>)}</ul>
          </> : <p>All required information is complete.</p>}
        </section>
        <div className="inspection-review-face-heading">
          <h5>Visit &amp; condition</h5>
          <button type="button" className="secondary-button" ref={reviewVisitButton} onClick={()=>editVisit()}>Edit visit &amp; condition</button>
        </div>
        <dl className="inspection-review">
          <div><dt>Visit</dt><dd>{draft.inspectedAt ? formatDate(draft.inspectedAt) : updating ? `${draft.inspectionYear} (exact date unknown)` : "Required: enter an inspection date"} · {inspectionTypeLabels[draft.sourceType]}</dd></div>
          <div><dt>Source</dt><dd>{draft.source.trim() ? draft.source : "Required: enter an inspection source"}</dd></div>
          <div><dt>Condition</dt><dd>{conditions.find(condition => condition.id === draft.conditionId)?.label || "Required: choose a condition"}</dd></div>
        </dl>
        {draft.conditionNotes ? <p className="note-box">{draft.conditionNotes}</p> : null}
        {(draft.faces ?? []).map((face, index) => <section key={face.id}>
          <div className="inspection-review-face-heading">
            <h5>{face.label.trim() ? face.label : `Face ${index + 1}: label required`}</h5>
            <button type="button" className="secondary-button" ref={element=>{if(element)reviewEditButtons.current.set(face.id,element);else reviewEditButtons.current.delete(face.id);}} aria-label={`Edit face ${index + 1}: ${face.label.trim() ? face.label : "Unlabeled face"}`} onClick={()=>editFace(face.id)}>Edit face</button>
          </div>
          <InspectionFaceReading face={face} />
          {face.designNotes ? <p className="note-box">{face.designNotes}</p> : null}
          <Suspense fallback={<p>Loading face photos…</p>}><InspectionFacePhotoReview faceId={face.id} faceLabel={face.label.trim()?face.label:`Face ${index+1}`}
            photos={draft.photos??[]} assets={headstone.mediaAssets??[]} linkedPhotos={existingPhotoLinks}
            includeLinked={Boolean(editInspectionId)} loading={Boolean(editInspectionId&&!photoCountsReady)} unavailable={Boolean(photoCountsError)}
            onRetry={()=>setPhotoCountRetry(current=>current+1)}/></Suspense>
        </section>)}
        {!isCombined(draft.inscription, draft.faces) && draft.inscription ? <><h5>Additional / unassigned inscription</h5><p className="note-box inscription-box">{draft.inscription}</p></> : null}
        <p role="status">{draft.photos?.length ?? 0} photos ready to save. The inspection is saved first, then its photos are uploaded and linked.</p>
      </div>
      </fieldset>
      {showCorrectionPanel ? <section ref={correctionPanel} className="inspection-correction-status" aria-label="Current required item">
        <div className={`inspection-correction-header${missingRequiredCount ? "" : " is-complete"}`}><div>
        <p id={`${requirementsId}-current`} aria-live="polite" aria-atomic="true"><strong>{correctionStatus}</strong></p>
        <p id={`${requirementsId}-remaining`}>{currentCorrectionIndex>=0 ? `Item ${currentCorrectionIndex+1} of ${missingRequiredCount} remaining.`
          : missingRequiredCount ? `${missingRequiredCount} required ${missingRequiredCount===1?"item":"items"} remaining.` : "All required information is complete. Return to review when ready."}</p>
        </div>{missingRequiredCount>0 ? <button type="button" className="secondary-button inspection-correction-toggle"
          aria-expanded={remainingItemsControl.open} aria-controls={`${requirementsId}-controls`}
          onClick={()=>{
            if(!remainingItemsControl.open) pendingItemListFocusRef.current=(missingItems.find(item=>item.key===currentCorrectionKey)??missingItems[0])?.key??null;
            remainingItemsControl.apply(!remainingItemsControl.open);
          }}>{remainingItemsControl.open ? "Hide" : "Show"} {remainingItemsControl.controlLabel}</button> : null}</div>
        <div id={`${requirementsId}-controls`} className="inspection-correction-body" hidden={!remainingItemsControl.open}>
        {missingRequiredCount>0 ? <details className="inspection-keyboard-help" open={keyboardHelpControl.open}>
          <summary onClick={event=>{event.preventDefault();keyboardHelpControl.apply(!keyboardHelpControl.open);}}>{keyboardHelpControl.controlLabel}</summary>
          <ul id={`${requirementsId}-keyboard-hint`} className="inspection-keyboard-hint">
          <li><kbd>Up/Down</kbd> <span>Move between items</span></li>
          <li><kbd>Home/End</kbd> <span>First/last item</span></li>
          <li><kbd>Enter/Space</kbd> <span>Edit</span></li>
          <li><kbd>Tab/Shift+Tab</kbd> <span>Next/previous control</span></li>
          <li><kbd>Escape</kbd> <span>Return to field</span></li>
          </ul>
        </details> : null}
        {missingRequiredCount>0 ? <ol className="inspection-required-choices" aria-label="Remaining required items" aria-describedby={`${requirementsId}-keyboard-hint`} onKeyDown={handleRemainingItemsKey}>
          {missingItems.map(item=><li key={item.key}><button type="button" className="secondary-button"
            ref={element=>{if(element)requiredItemButtons.current.set(item.key,element);else requiredItemButtons.current.delete(item.key);}}
            aria-keyshortcuts="ArrowUp ArrowDown Home End Escape"
            onKeyDown={event => handleRequiredItemKey(event, item.key)}
            aria-current={item.key===currentCorrectionKey ? "true" : undefined} onClick={()=>{setCorrectionCollapsed(true);selectMissingItem(item);}}>
            {item.field ? requiredVisitLabels[item.field] : `Face ${(draft.faces??[]).findIndex(face=>face.id===item.faceId)+1} label`}
            {item.key===currentCorrectionKey ? <span> — Current item</span> : null}
          </button></li>)}
          </ol> : null}
        </div>
        <div className="inspection-correction-actions">
          {missingRequiredCount>0 ? <>
            <button type="button" className="secondary-button" aria-describedby={`${requirementsId}-current ${requirementsId}-remaining`} aria-label="Previous missing item" onClick={()=>moveMissingItem(-1)}>Previous</button>
            <button type="button" className="secondary-button" aria-describedby={`${requirementsId}-current ${requirementsId}-remaining`} aria-label="Next missing item" onClick={()=>moveMissingItem(1)}>Next</button>
          </> : null}
          <button type="button" className="inspection-correction-return" onClick={advanceStep}>Return to review</button>
        </div>
      </section> : null}
      <div className="headstone-form-actions inspection-actions inspection-workflow-actions">
        {!draft.recordSaved && step > 0 ? <button type="button" className="secondary-button" onClick={() => goToStep(step - 1)}>Back</button> : null}
        {!draft.recordSaved && step < 2 && !correctingRequired ? <button type="button" onClick={advanceStep}>{editingFromReview ? "Return to review" : `Next: ${steps[step + 1]}`}</button> : null}
        {step === 2 || draft.recordSaved ? <button type="button" disabled={missingRequiredCount>0 || missingPhotoFiles.length>0} onClick={() => void save()}>{saving ? "Saving..." : draft.recordSaved ? (draft.photos?.some(p=>!p.saved) ? "Retry remaining photos" : "Finish inspection") : "Save inspection"}</button> : null}
        <button type="button" className="secondary-button" onClick={() => { clearRecovery(); setDraft(null); setError(undefined); }}>{draft.recordSaved ? "Close saved inspection" : "Cancel inspection"}</button>
      </div>
      <InspectionDisplaySettings {...{ displayPreferencesReset, displayResetButton, displayResetNotice, resetDisplayPreferences, restoredDefaultsControl, restoredDisplayDefaults, resetKeyboardHelpControl, dismissDisplayReset, requirementsId }} />
    </fieldset> : null}
    {error ? <p className="detail-message is-error" role="alert">{error}</p> : null}
  </section>;
}
