import { sortedMonumentInspections, inspectionTypeLabels } from "../../lib/monumentInspections";
import { inspectionFacePhotos, type InspectionPhotoDraft } from "../../lib/inspectionPhotos";
import { fetchPhotoContexts, savePhotoContext, type PhotoContext } from "../../api/mediaApi";
import { PhotoGalleryContext } from "./photoGalleryContext";
import { RecordPhotos } from "./RecordPhotos";
import type { ComponentProps } from "react";
import { lazy, Suspense, useContext, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { useDraftState } from "../../hooks/useDraftState";
import type { Headstone, InspectionInput, InspectionFace, LookupOption } from "../../types";
import { formatDate } from "../../lib/format";

const InspectionFacePhotos = lazy(() => import("./InspectionFacePhotos").then(module => ({default:module.InspectionFacePhotos})));

const InspectionFacePhotoReview = lazy(() => import("./InspectionFacePhotos").then(module => ({default:module.InspectionFacePhotoReview})));

type RequiredVisitField = "date" | "source" | "condition";
const remainingItemsPreferenceKey = "cemetery-mapping:inspection-remaining-items-open";
const restoredDefaultsPreferenceKey = "cemetery-mapping:inspection-restored-defaults-open";
const resetKeyboardHelpPreferenceKey = "cemetery-mapping:inspection-reset-keyboard-help-open";
const keyboardHelpPreferenceKey = "cemetery-mapping:inspection-keyboard-help-open";
const displayPreferenceSettings = [
  {key:"remainingItems",id:remainingItemsPreferenceKey,label:"Remaining items",controlLabel:"remaining items",defaultOpen:true},
  {key:"keyboardHelp",id:keyboardHelpPreferenceKey,label:"Inspection keyboard hint",controlLabel:"Keyboard shortcuts",defaultOpen:false},
  {key:"resetKeyboardHelp",id:resetKeyboardHelpPreferenceKey,label:"Reset confirmation keyboard hint",controlLabel:"Keyboard shortcuts",defaultOpen:false},
  {key:"restoredDefaults",id:restoredDefaultsPreferenceKey,label:"Restored-defaults list",controlLabel:"Restored defaults",defaultOpen:false},
] as const;
type DisplayPreferenceKey = typeof displayPreferenceSettings[number]["key"];
const displayPreferenceSetting = (key:DisplayPreferenceKey) => displayPreferenceSettings.find(setting=>setting.key===key)!;
const readDisplayPreference = (key:DisplayPreferenceKey) => {
  const setting=displayPreferenceSetting(key);
  try {
    const stored=window.localStorage.getItem(setting.id);
    return stored==="true" ? true : stored==="false" ? false : setting.defaultOpen;
  } catch { return setting.defaultOpen; }
};
const saveDisplayPreference = (key:DisplayPreferenceKey,open:boolean) => {
  try { window.localStorage.setItem(displayPreferenceSetting(key).id,String(open)); }
  catch { /* Keep the in-session choice when browser storage is unavailable. */ }
};
const requiredVisitLabels = {date:"Inspection date",source:"Inspection source",condition:"Monument condition"};

type InspectionDraft = InspectionInput & { photos?: InspectionPhotoDraft[]; recordSaved?: boolean };

const combinedReading = (faces: InspectionFace[]) => faces.length === 1 ? faces[0].inscription : faces.map(f=>`${f.label}\n${f.inscription}`).join("\n\n");
const isCombined = (inscription: string, faces: InspectionFace[] = []) => faces.length > 0 && inscription === combinedReading(faces);
const draftFaces = (inscription: string, faces: InspectionFace[] = []): InspectionFace[] => faces.length
  ? faces.map(({id,label,inscription,designNotes}) => ({id,label,inscription,...(designNotes===undefined?{}:{designNotes})}))
  : [{id:crypto.randomUUID(),label:"Front",inscription}];
const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function MonumentInspections({ headstone, conditions = [], onSave, onUploadPhoto, showHeading = true, startNew = false, onStarted }: {
  onStarted?: () => void;
  startNew?: boolean;
  showHeading?: boolean;
  headstone: Headstone;
  conditions?: LookupOption[];
  onUploadPhoto?: ComponentProps<typeof RecordPhotos>["onUpload"];
  onSave?: (entry: InspectionInput, updating: boolean) => Promise<Headstone>;
}) {
  const {open:openPhotoGallery}=useContext(PhotoGalleryContext);
  const inspections = sortedMonumentInspections(headstone.inspections);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = inspections.find((entry) => entry.id === selectedId) ?? inspections[0];
  const [draft, setDraft] = useDraftState<InspectionDraft | null>(null);
  const [updating, setUpdating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [stepFocusRequest, setStepFocusRequest] = useState(0);
  const [editingFromReview, setEditingFromReview] = useState<"face" | "visit" | null>(null);
  const [requiredCorrection, setRequiredCorrection] = useState<string | null>(null);
  const [returnToRequiredSummary, setReturnToRequiredSummary] = useState(false);
  const [activeFaceId, setActiveFaceId] = useState<string>();
  const activeFace = draft?.faces?.find(face => face.id === activeFaceId) ?? draft?.faces?.[0];
  const [linkedPhotos, setLinkedPhotos] = useState<{key:string; links?:PhotoContext[]; error?:string}>();
  const [photoCountRetry, setPhotoCountRetry] = useState(0);
  const editInspectionId = updating && draft && !draft.recordSaved ? draft.id : undefined;
  const photoCountKey = `${headstone.id}/${editInspectionId}/${photoCountRetry}`;
  useEffect(() => {
    if (!editInspectionId) return;
    const controller = new AbortController();
    void fetchPhotoContexts(headstone.id, controller.signal).then(links => {
      if (!controller.signal.aborted) setLinkedPhotos({key:photoCountKey, links:links.filter(link => link.inspectionId === editInspectionId)});
    }).catch(() => {
      if (!controller.signal.aborted) setLinkedPhotos({key:photoCountKey, error:"Linked photo counts could not be loaded."});
    });
    return () => controller.abort();
  }, [headstone.id, editInspectionId, photoCountKey]);
  const photoCountsReady = linkedPhotos?.key === photoCountKey;
  const photoCountsError = photoCountsReady ? linkedPhotos.error : undefined;
  const existingPhotoLinks = photoCountsReady ? linkedPhotos.links ?? [] : [];
  const steps = ["Visit & condition", "Faces & photos", "Review & save"];
  const requirementsId = useId();
  const missingVisitFields: RequiredVisitField[] = draft ? [
    ...(!draft.inspectedAt && !updating ? ["date" as const] : []),
    ...(!draft.source.trim() ? ["source" as const] : []),
    ...(!draft.conditionId ? ["condition" as const] : []),
  ] : [];
  const missingFaces = (draft?.faces ?? []).flatMap((face,index) => !face.label.trim() ? [{id:face.id,number:index+1}] : []);
  const missingRequiredCount = missingVisitFields.length + missingFaces.length;
  const missingItems: {key:string;field?:RequiredVisitField;faceId?:string}[] = [
    ...missingVisitFields.map(field=>({key:`visit:${field}`,field})),
    ...missingFaces.map(face=>({key:`face:${face.id}`,faceId:face.id})),
  ];
  const currentCorrectionKey = requiredCorrection && step===1 && activeFace ? `face:${activeFace.id}` : requiredCorrection;
  const currentCorrectionIndex = missingItems.findIndex(item=>item.key===currentCorrectionKey);
  const correctionFaceIndex = (draft?.faces??[]).findIndex(face=>`face:${face.id}`===currentCorrectionKey);
  const correctionLabel = currentCorrectionKey?.startsWith("visit:") ? requiredVisitLabels[currentCorrectionKey.slice(6) as RequiredVisitField]
    : correctionFaceIndex>=0 ? `Face ${correctionFaceIndex+1} label` : "Required item";
  const correctionStatus = !currentCorrectionKey ? "Choose a remaining required item below, or use Previous or Next."
    : currentCorrectionIndex>=0 ? `Correcting: ${correctionLabel}.` : `${correctionLabel} complete.`;
  const correctingRequired = requiredCorrection !== null || Boolean(editingFromReview && missingRequiredCount);
  const showCorrectionPanel = Boolean(draft && !draft.recordSaved && step<2 && correctingRequired);
  const correctionPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    const panel = correctionPanel.current;
    const editor = panel?.closest('fieldset');
    if (!panel || !editor) return;
    const measure = () => editor.style.setProperty('--inspection-correction-height', `${panel.getBoundingClientRect().height + 12}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => { observer.disconnect(); editor.style.removeProperty('--inspection-correction-height'); };
  }, [showCorrectionPanel]);
  const [displayPreferencesReset,setDisplayPreferencesReset] = useState(false);
  const [restoredDefaultsOpen,setRestoredDefaultsOpen] = useState(()=>readDisplayPreference("restoredDefaults"));
  const rememberRestoredDefaults = (open:boolean) => {
    setRestoredDefaultsOpen(open);
    saveDisplayPreference("restoredDefaults",open);
  };
  const [resetKeyboardHelpOpen,setResetKeyboardHelpOpen] = useState(()=>readDisplayPreference("resetKeyboardHelp"));
  const rememberResetKeyboardHelp = (open:boolean) => {
    setResetKeyboardHelpOpen(open);
    saveDisplayPreference("resetKeyboardHelp",open);
  };
  const displayResetButton = useRef<HTMLButtonElement | null>(null);
  const displayResetNotice = useRef<HTMLDivElement | null>(null);
  const displayResetTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(()=>()=>clearTimeout(displayResetTimeout.current),[]);
  const [remainingItemsOpen,setRemainingItemsOpen] = useState(()=>readDisplayPreference("remainingItems"));
  const [correctionCollapsed,setCorrectionCollapsed] = useState(!remainingItemsOpen);
  const rememberRemainingItems = (open:boolean) => {
    setDisplayPreferencesReset(false);
    setRemainingItemsOpen(open);
    setCorrectionCollapsed(!open);
    saveDisplayPreference("remainingItems",open);
  };
  const [keyboardHelpOpen,setKeyboardHelpOpen] = useState(()=>readDisplayPreference("keyboardHelp"));
  const rememberKeyboardHelp = (open:boolean) => {
    setDisplayPreferencesReset(false);
    setKeyboardHelpOpen(open);
    saveDisplayPreference("keyboardHelp",open);
  };
  const displayPreferenceWriters = {
    remainingItems:rememberRemainingItems,
    keyboardHelp:rememberKeyboardHelp,
    resetKeyboardHelp:rememberResetKeyboardHelp,
    restoredDefaults:rememberRestoredDefaults,
  } satisfies Record<DisplayPreferenceKey,(open:boolean)=>void>;
  const displayPreferenceValues = {
    remainingItems:!correctionCollapsed,
    keyboardHelp:keyboardHelpOpen,
    resetKeyboardHelp:resetKeyboardHelpOpen,
    restoredDefaults:restoredDefaultsOpen,
  } satisfies Record<DisplayPreferenceKey,boolean>;
  const restoredDisplayDefaults = displayPreferenceSettings.map(setting=>({
    ...setting,open:displayPreferenceValues[setting.key],apply:displayPreferenceWriters[setting.key],
  }));
  const preferenceControl = (key:DisplayPreferenceKey) => restoredDisplayDefaults.find(setting=>setting.key===key)!;
  const remainingItemsControl=preferenceControl("remainingItems");
  const keyboardHelpControl=preferenceControl("keyboardHelp");
  const resetKeyboardHelpControl=preferenceControl("resetKeyboardHelp");
  const restoredDefaultsControl=preferenceControl("restoredDefaults");
  const requiredItemButtons = useRef(new Map<string, HTMLButtonElement>());
  const pendingItemListFocus = useRef<string | null>(null);
  useEffect(()=>{
    if(correctionCollapsed || !pendingItemListFocus.current) return;
    const target=requiredItemButtons.current.get(pendingItemListFocus.current);
    pendingItemListFocus.current=null;
    target?.scrollIntoView({block:"nearest",inline:"nearest"});
    target?.focus({preventScroll:true});
  },[correctionCollapsed]);
  const requiredSummaryHeading = useRef<HTMLHeadingElement | null>(null);
  const pendingRequiredSummaryFocus = useRef(false);
  const requiredVisitInputs = useRef(new Map<RequiredVisitField, HTMLInputElement | HTMLSelectElement>());
  const requiredVisitFocus = useRef<RequiredVisitField | null>(null);
  const visitTypeInput = useRef<HTMLSelectElement | null>(null);
  const reviewVisitButton = useRef<HTMLButtonElement | null>(null);
  const pendingVisitFocus = useRef<"editor" | "review" | null>(null);
  const faceLabelInputs = useRef(new Map<string, HTMLInputElement>());
  const reviewEditButtons = useRef(new Map<string, HTMLButtonElement>());
  const reviewReturnFocus = useRef<string | undefined>(undefined);
  const reviewFaceFocus = useRef<string | undefined>(undefined);
  const stageHeadings = useRef<(HTMLHeadingElement | null)[]>([]);
  const hasDraft=Boolean(draft);
  useEffect(()=>{
    if(!hasDraft)return;
    const summaryHeading = step === 2 && pendingRequiredSummaryFocus.current ? requiredSummaryHeading.current : null;
    pendingRequiredSummaryFocus.current = false;
    if(summaryHeading){summaryHeading.scrollIntoView({block:"start"});summaryHeading.focus({preventScroll:true});return;}
    const requiredInput = step === 0 && requiredVisitFocus.current ? requiredVisitInputs.current.get(requiredVisitFocus.current) : undefined;
    requiredVisitFocus.current = null;
    if(requiredInput){requiredInput.scrollIntoView({block:"center"});requiredInput.focus({preventScroll:true});return;}
    const visitTarget = step === 0 && pendingVisitFocus.current === "editor" ? visitTypeInput.current
      : step === 2 && pendingVisitFocus.current === "review" ? reviewVisitButton.current : null;
    pendingVisitFocus.current = null;
    if(visitTarget){visitTarget.scrollIntoView({block:"center"});visitTarget.focus({preventScroll:true});return;}
    const reviewButton = step === 2 && reviewReturnFocus.current ? reviewEditButtons.current.get(reviewReturnFocus.current) : undefined;
    reviewReturnFocus.current = undefined;
    if(reviewButton){reviewButton.scrollIntoView({block:"center"});reviewButton.focus({preventScroll:true});return;}
    const faceInput = step === 1 && reviewFaceFocus.current ? faceLabelInputs.current.get(reviewFaceFocus.current) : undefined;
    reviewFaceFocus.current = undefined;
    if(faceInput){faceInput.scrollIntoView({block:"center"});faceInput.focus({preventScroll:true});return;}
    const heading=stageHeadings.current[step];
    heading?.scrollIntoView({block:"nearest"});heading?.focus({preventScroll:true});
  },[hasDraft,step,stepFocusRequest]);
  const goToStep = (next:number) => {
    setEditingFromReview(null);
    setRequiredCorrection(null);
    setReturnToRequiredSummary(false);
    setStep(next);
  };
  const collapseForRequiredItem = () => {
    if(window.matchMedia("(max-width: 760px)").matches) setCorrectionCollapsed(true);
  };
  const editVisit = (field?:RequiredVisitField) => {
    if(field) collapseForRequiredItem();
    if(field) requiredVisitFocus.current=field;
    else pendingVisitFocus.current="editor";
    goToStep(0);
    setEditingFromReview("visit");
    setReturnToRequiredSummary(Boolean(field));
    setRequiredCorrection(field?`visit:${field}`:null);
  };
  const editFace = (faceId:string, fromRequiredSummary=false) => {
    if(fromRequiredSummary) collapseForRequiredItem();
    reviewFaceFocus.current=faceId;
    setActiveFaceId(faceId);
    goToStep(1);
    setEditingFromReview("face");
    setReturnToRequiredSummary(fromRequiredSummary);
    setRequiredCorrection(fromRequiredSummary?`face:${faceId}`:null);
  };
  const navigateToStep = (next:number) => {
    setStepFocusRequest(current=>current+1);
    const visitField = next !== 1 ? missingVisitFields[0] : undefined;
    const face = next !== 0 ? missingFaces[0] : undefined;
    const fromReview = step === 2 || next === 2;
    if(visitField || face) collapseForRequiredItem();
    if(visitField){
      if(fromReview) editVisit(visitField);
      else {requiredVisitFocus.current=visitField;goToStep(0);setRequiredCorrection(`visit:${visitField}`);}
    } else if(face){
      if(fromReview) editFace(face.id,true);
      else {reviewFaceFocus.current=face.id;setActiveFaceId(face.id);goToStep(1);setRequiredCorrection(`face:${face.id}`);}
    } else goToStep(next);
  };
  const advanceStep = () => {
    if(returnToRequiredSummary || requiredCorrection) pendingRequiredSummaryFocus.current=true;
    else if(editingFromReview === "face") reviewReturnFocus.current=activeFace?.id;
    else if(editingFromReview === "visit") pendingVisitFocus.current="review";
    goToStep(editingFromReview || correctingRequired ? 2 : step + 1);
  };
  const dismissDisplayReset = (restoreFocus=false) => {
    clearTimeout(displayResetTimeout.current);
    setDisplayPreferencesReset(false);
    if(restoreFocus || displayResetNotice.current?.contains(document.activeElement)) displayResetButton.current?.focus({preventScroll:true});
  };
  const resetDisplayPreferences = () => {
    pendingItemListFocus.current=null;
    restoredDisplayDefaults.forEach(setting=>setting.apply(setting.defaultOpen));
    setDisplayPreferencesReset(true);
    clearTimeout(displayResetTimeout.current);
    displayResetTimeout.current=setTimeout(()=>dismissDisplayReset(),4000);
  };
  const hideRemainingItems = () => {
    remainingItemsControl.apply(false);
    pendingItemListFocus.current=null;
    if(step===0 && currentCorrectionKey?.startsWith("visit:")) requiredVisitFocus.current=currentCorrectionKey.slice(6) as RequiredVisitField;
    else if(step===1 && activeFace) reviewFaceFocus.current=activeFace.id;
    else if(step===0) pendingVisitFocus.current="editor";
    setStepFocusRequest(current=>current+1);
  };
  const selectMissingItem = (item:typeof missingItems[number]) => {
    setStepFocusRequest(current=>current+1);
    if(item.field) editVisit(item.field);
    else if(item.faceId) editFace(item.faceId,true);
  };
  const moveMissingItem = (direction:1|-1) => {
    const order = ["visit:date","visit:source","visit:condition",...(draft?.faces??[]).map(face=>`face:${face.id}`)];
    const currentIndex = currentCorrectionKey ? order.indexOf(currentCorrectionKey) : direction===1 ? -1 : order.length;
    const candidates = direction===1 ? missingItems : [...missingItems].reverse();
    const next = candidates.find(item=>direction===1 ? order.indexOf(item.key)>currentIndex : order.indexOf(item.key)<currentIndex) ?? candidates[0];
    if(!next) return;
    selectMissingItem(next);
  };
  const [error, setError] = useState<string>();
  const change = (value: Partial<InspectionInput>) => setDraft((current) => current ? { ...current, ...value } : current);

  const changeFaces = (faces: InspectionFace[]) => {
    if (!draft) return;
    change({faces,...(isCombined(draft.inscription,draft.faces) ? {inscription:combinedReading(faces)} : {})});
  };

  const begin = (edit: boolean) => {
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
      conditionNotes: selected.conditionNotes, inscription: selected.inscription, expectedUpdatedAt: selected.updatedAt,
      faces: draftFaces(selected.inscription, selected.faces),
    } : {
      id: crypto.randomUUID(), inspectedAt: localToday(), sourceType: "field_survey",
      source: "Cemetery administrator field inspection",
      conditionId: conditions.find((c) => c.code === "unknown")?.id ?? "",
      conditionNotes: "", inscription: selected?.inscription ?? headstone.inscription ?? "",
      faces: draftFaces(selected?.inscription ?? headstone.inscription ?? "", selected ? selected.faces : headstone.faces),
    });
  };
  const launchNew = useEffectEvent(()=>begin(false));
  const launched = useRef(false);
  useEffect(()=>{
    if(startNew && onSave && !launched.current){launched.current=true;launchNew();onStarted?.();}
  },[startNew,onSave,onStarted]);
  const save = async () => {
    if (!draft || !onSave || missingRequiredCount) return;
    setSaving(true); setError(undefined);
    try {
      if (!draft.recordSaved) {
        const entry: InspectionDraft = {...draft};
        delete entry.photos; delete entry.recordSaved;
        await onSave(entry, updating);
        setSelectedId(draft.id);
        setDraft(current=>current?{...current,recordSaved:true}:current);
      }
      const failures: string[] = [];
      for (const photo of draft.photos ?? []) {
        if (photo.saved) continue;
        try {
          if (photo.file) {
            if (!onUploadPhoto) throw new Error("Photo uploads are unavailable. The inspection has been saved.");
            await onUploadPhoto({file:photo.file,headstoneId:headstone.id,inspectionId:draft.id,faceId:photo.faceId,notes:photo.notes,capturedAt:photo.capturedAt||undefined});
          } else if (photo.mediaAssetId) {
            await savePhotoContext(headstone.id,photo.mediaAssetId,{inspectionId:draft.id,faceId:photo.faceId,phase:"unspecified"});
          }
          setDraft(current=>current?{...current,photos:current.photos?.map(p=>p.id===photo.id?{...p,saved:true}:p)}:current);
        } catch (cause) {
          const name=photo.file?.name||headstone.mediaAssets?.find(a=>a.id===photo.mediaAssetId)?.originalFilename||"Photo";
          failures.push(`${name}: ${cause instanceof Error?cause.message:"Unable to save photo."}`);
        }
      }
      if(failures.length) throw new Error(failures.join(" "));
      setSelectedId(draft.id);
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save inspection.");
    } finally { setSaving(false); }
  };

  return <section className="headstone-wide-field monument-inspections" aria-label="Inspections">
    {showHeading ? <h4>Inspections</h4> : null}
    {inspections.length ? <label>Inspection
      <select value={selected?.id ?? ""} disabled={Boolean(draft)} onChange={(event) => setSelectedId(event.target.value)}>
        {inspections.map((entry) => <option key={entry.id} value={entry.id}>
          {entry.inspectedAt ? formatDate(entry.inspectedAt) : `${entry.inspectionYear} (exact date unknown)`} · {inspectionTypeLabels[entry.sourceType]} · {entry.source}
        </option>)}
      </select>
    </label> : <p className="muted">No inspections recorded.</p>}
    {selected && !draft ? <div aria-label="Selected inspection">
      <p><strong>Condition:</strong> {selected.condition}</p>
      {selected.conditionNotes ? <p className="note-box">{selected.conditionNotes}</p> : null}
      <p><strong>Source:</strong> {selected.source}</p>
      {(selected.faces ?? []).map(face => <div key={face.id}>
        <h5>{face.label}</h5>
        {face.inscription ? <p className="note-box inscription-box">{face.inscription}</p> : <p className="muted">No inscription recorded for this face.</p>}
        {face.designNotes ? <p className="note-box"><strong>Flourishes or designs:</strong> {face.designNotes}</p> : null}
      </div>)}
      {!isCombined(selected.inscription,selected.faces) ? <><h5>{selected.faces?.length ? "Additional / unassigned inscription" : "Inscription"}</h5>
      {selected.inscription ? <p className="note-box inscription-box">{selected.inscription}</p> : <p className="muted">No inscription recorded for this inspection.</p>}</> : null}
    </div> : null}
    {selected && !draft ? <RecordPhotos key={selected.id} headstone={headstone} faces={selected.faces ?? []} inspectionId={selected.id} canUpdate={Boolean(onSave)} onUpload={onUploadPhoto} /> : null}
    {onSave && !draft ? <div className="headstone-form-actions inspection-actions">
      <button type="button" onClick={() => begin(false)}>New inspection</button>
      {selected ? <button type="button" className="secondary-button" onClick={() => begin(true)}>Edit inspection</button> : null}
    </div> : null}
    {draft ? <fieldset className="inspection-editor" disabled={saving} onKeyDown={event=>{
      if(event.key!=="Escape" || !displayPreferencesReset || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();event.stopPropagation();dismissDisplayReset(true);
    }}>
      <legend>{updating ? "Edit inspection" : "New inspection"}</legend>
      {!updating && step === 1 ? <p className="muted">The inscription was copied from {selected ? "the selected inspection" : "the marker"}. Edit it or save it as-is. Photo links are not copied. Add photos under each face; they will be linked when you save.</p> : null}
      {draft.recordSaved?<div role="status">
        <p>Inspection saved. {(draft.photos ?? []).filter(photo => !photo.saved).length} photos need retry. Retry the remaining photos, or close to keep the inspection and photos already saved.</p>
        <ul>{(draft.photos??[]).map(photo=><li key={photo.id}>{photo.file?.name||headstone.mediaAssets?.find(a=>a.id===photo.mediaAssetId)?.originalFilename||"Monument photo"}: {photo.saved?"Saved and linked":"Pending"}{!photo.saved?<button type="button" className="secondary-button" onClick={()=>setDraft(current=>current?{...current,photos:current.photos?.filter(p=>p.id!==photo.id)}:current)}>Remove pending photo</button>:null}</li>)}</ul>
      </div>:null}
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
      <h5 tabIndex={-1} ref={element => { stageHeadings.current[0] = element; }}>Visit &amp; condition</h5>
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
      <h5 tabIndex={-1} ref={element => { stageHeadings.current[1] = element; }}>Faces &amp; photos</h5>
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
            <span id={`inspection-face-reading-${face.id}`}>{face.inscription.trim() ? "Reading recorded" : "No reading recorded"}</span>
            <span id={`inspection-face-photos-${face.id}`}>{photoLabel}</span>
          </button>;
        })}
      </div>
      {(draft.faces ?? []).map((face,index) => <fieldset key={face.id} id={`inspection-face-${face.id}`} hidden={activeFace?.id !== face.id} aria-label={`Inspection face ${index+1}`}>
        <legend>Face {index+1}</legend>
        <label>Face label<input aria-required="true" aria-invalid={!face.label.trim()||undefined} aria-describedby={!face.label.trim()?`${requirementsId}-face-${face.id}`:undefined} ref={element=>{if(element)faceLabelInputs.current.set(face.id,element);else faceLabelInputs.current.delete(face.id);}} value={face.label} maxLength={100} onChange={e=>changeFaces(draft.faces!.map(f=>f.id===face.id?{...f,label:e.target.value}:f))} /></label>
        <label>Face inscription<textarea value={face.inscription} maxLength={20000} rows={5} onChange={e=>changeFaces(draft.faces!.map(f=>f.id===face.id?{...f,inscription:e.target.value}:f))} /></label>
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
        <h5 tabIndex={-1} ref={element => { stageHeadings.current[2] = element; }}>Review &amp; save</h5>
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
          <p className="note-box inscription-box">{face.inscription || "No inscription recorded for this face."}</p>
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
            if(!remainingItemsControl.open) pendingItemListFocus.current=(missingItems.find(item=>item.key===currentCorrectionKey)??missingItems[0])?.key??null;
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
        {missingRequiredCount>0 ? <ol className="inspection-required-choices" aria-label="Remaining required items" aria-describedby={`${requirementsId}-keyboard-hint`} onKeyDown={event=>{
          if(event.key!=="Escape" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          event.preventDefault();event.stopPropagation();hideRemainingItems();
        }}>
          {missingItems.map(item=><li key={item.key}><button type="button" className="secondary-button"
            ref={element=>{if(element)requiredItemButtons.current.set(item.key,element);else requiredItemButtons.current.delete(item.key);}}
            aria-keyshortcuts="ArrowUp ArrowDown Home End Escape"
            onKeyDown={event=>{
              if(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
              const index=missingItems.findIndex(candidate=>candidate.key===item.key);
              const next=event.key==="ArrowDown" ? (index+1)%missingItems.length
                : event.key==="ArrowUp" ? (index+missingItems.length-1)%missingItems.length
                : event.key==="Home" ? 0 : event.key==="End" ? missingItems.length-1 : -1;
              if(next<0) return;
              event.preventDefault();
              const target=requiredItemButtons.current.get(missingItems[next].key);
              target?.scrollIntoView({block:"nearest",inline:"nearest"});
              target?.focus({preventScroll:true});
            }}
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
        {step === 2 || draft.recordSaved ? <button type="button" disabled={missingRequiredCount>0} onClick={() => void save()}>{saving ? "Saving..." : draft.recordSaved ? (draft.photos?.some(p=>!p.saved) ? "Retry remaining photos" : "Finish inspection") : "Save inspection"}</button> : null}
        <button type="button" className="secondary-button" onClick={() => { setDraft(null); setError(undefined); }}>{draft.recordSaved ? "Close saved inspection" : "Cancel inspection"}</button>
      </div>
      <section className="inspection-display-settings" aria-label="Display preferences">
      <h5>Display preferences</h5>
      <button type="button" className="secondary-button inspection-display-preferences-reset" ref={displayResetButton} onClick={resetDisplayPreferences}>Reset display preferences</button>
      {displayPreferencesReset ? <div className="inspection-display-reset-notice" ref={displayResetNotice}>
          <div><div className="inspection-restored-defaults">
            <p role="status">Display defaults restored:</p>
            <details className="inspection-restored-defaults-list" open={restoredDefaultsControl.open}>
              <summary onClick={event=>{event.preventDefault();restoredDefaultsControl.apply(!restoredDefaultsControl.open);}}>{restoredDefaultsControl.controlLabel} ({restoredDisplayDefaults.length})</summary>
            <ul>
              {restoredDisplayDefaults.map(setting=><li key={setting.id}>{setting.label}: {setting.defaultOpen?"shown":"hidden"}</li>)}
            </ul>
            </details>
          </div>
          <details className="inspection-reset-keyboard-help" open={resetKeyboardHelpControl.open}>
            <summary onClick={event=>{event.preventDefault();resetKeyboardHelpControl.apply(!resetKeyboardHelpControl.open);}}>{resetKeyboardHelpControl.controlLabel}</summary>
          <ul id={`${requirementsId}-reset-escape`} className="inspection-reset-escape-hint">
            <li><kbd>Tab/Shift+Tab</kbd> <span>Next/previous control</span></li>
            <li><kbd>Enter/Space</kbd> <span>Activate Dismiss</span></li>
            <li><kbd>Escape</kbd> <span>Dismiss and return to Reset display preferences</span></li>
          </ul>
          </details></div>
          <button type="button" className="secondary-button" aria-label="Dismiss display preferences confirmation" aria-keyshortcuts="Escape" aria-describedby={`${requirementsId}-reset-escape`} onClick={()=>dismissDisplayReset(true)}>Dismiss</button>
        </div> : null}
      </section>
    </fieldset> : null}
    {error ? <p className="detail-message is-error" role="alert">{error}</p> : null}
  </section>;
}
