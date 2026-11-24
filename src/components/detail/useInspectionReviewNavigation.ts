import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { InspectionDraft } from "../../lib/inspectionDraftRecovery";
import type { useInspectionDisplayPreferences } from "./useInspectionDisplayPreferences";

type RequiredVisitField = "date" | "source" | "condition";
export const requiredVisitLabels = {date:"Inspection date",source:"Inspection source",condition:"Monument condition"};

type NavigationOptions = {
  draft: InspectionDraft | null;
  updating: boolean;
  step: number;
  setStep: (step: number) => void;
  activeFaceId?: string;
  setActiveFaceId: (id: string) => void;
} & Pick<ReturnType<typeof useInspectionDisplayPreferences>,
  "correctionCollapsed" | "setCorrectionCollapsed" | "remainingItemsControl" | "pendingItemListFocusRef">;

export function useInspectionReviewNavigation({
  draft, updating, step, setStep, activeFaceId, setActiveFaceId,
  correctionCollapsed, setCorrectionCollapsed, remainingItemsControl, pendingItemListFocusRef,
}: NavigationOptions) {
  const [stepFocusRequest, setStepFocusRequest] = useState(0);
  const [editingFromReview, setEditingFromReview] = useState<"face" | "visit" | null>(null);
  const [requiredCorrection, setRequiredCorrection] = useState<string | null>(null);
  const [returnToRequiredSummary, setReturnToRequiredSummary] = useState(false);
  const activeFace = draft?.faces?.find(face => face.id === activeFaceId) ?? draft?.faces?.[0];
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
  const requiredItemButtons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(()=>{
    if(correctionCollapsed || !pendingItemListFocusRef.current) return;
    const target=requiredItemButtons.current.get(pendingItemListFocusRef.current);
    pendingItemListFocusRef.current=null;
    target?.scrollIntoView({block:"nearest",inline:"nearest"});
    target?.focus({preventScroll:true});
  },[correctionCollapsed, pendingItemListFocusRef]);
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
  const setStageHeading = (index: number, element: HTMLHeadingElement | null) => {
    stageHeadings.current[index] = element;
  };
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
  const requestStepFocus = () => setStepFocusRequest(current => current + 1);

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
    requestStepFocus();
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
  const hideRemainingItems = () => {
    remainingItemsControl.apply(false);
    pendingItemListFocusRef.current=null;
    if(step===0 && currentCorrectionKey?.startsWith("visit:")) requiredVisitFocus.current=currentCorrectionKey.slice(6) as RequiredVisitField;
    else if(step===1 && activeFace) reviewFaceFocus.current=activeFace.id;
    else if(step===0) pendingVisitFocus.current="editor";
    requestStepFocus();
  };
  const selectMissingItem = (item:typeof missingItems[number]) => {
    requestStepFocus();
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
  const handleRemainingItemsKey = (event: KeyboardEvent<HTMLOListElement>) => {
    if (event.key !== "Escape" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    hideRemainingItems();
  };

  const handleRequiredItemKey = (event: KeyboardEvent<HTMLButtonElement>, itemKey: string) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const index = missingItems.findIndex(item => item.key === itemKey);
    const next = event.key === "ArrowDown" ? (index + 1) % missingItems.length
      : event.key === "ArrowUp" ? (index + missingItems.length - 1) % missingItems.length
      : event.key === "Home" ? 0 : event.key === "End" ? missingItems.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    const target = requiredItemButtons.current.get(missingItems[next].key);
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
    target?.focus({ preventScroll: true });
  };

  return {
    activeFace, missingVisitFields, missingFaces, missingRequiredCount, missingItems,
    currentCorrectionKey, currentCorrectionIndex, correctionStatus, correctingRequired, showCorrectionPanel,
    correctionPanel, requiredItemButtons, requiredSummaryHeading, requiredVisitInputs, visitTypeInput,
    reviewVisitButton, faceLabelInputs, reviewEditButtons, setStageHeading,
    editingFromReview, goToStep, editVisit, editFace, navigateToStep, advanceStep,
    selectMissingItem, moveMissingItem, handleRemainingItemsKey, handleRequiredItemKey, requestStepFocus,
  };
}
