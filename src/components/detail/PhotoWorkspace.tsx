import { timingLabels } from "./photoLabels";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Headstone } from "../../types";
import { fetchPhotoContexts, savePhotoContext, type PhotoContext } from "../../api/mediaApi";
import { formatDate } from "../../lib/format";
import { MediaGallery, PhotoUploadForm } from "./MediaRecords";
import { PhotoContextFields, PhotoThumbnail } from "./PhotoControls";
import { type GalleryPermissions, type GalleryTarget } from "./photoGalleryContext";
import { Modal } from "../ui/Modal";

export default function PhotoWorkspace({headstone,initialTarget,canUpdate,canEditInspections,canDelete,onUpload,onDelete,onMove,onClose}: GalleryPermissions & {headstone:Headstone;initialTarget:GalleryTarget;onClose:()=>void}) {
 const [record,setRecord]=useState(initialTarget.inspectionId?`inspection:${initialTarget.inspectionId}`:initialTarget.maintenanceRecordId?`maintenance:${initialTarget.maintenanceRecordId}`:"all");
 const [faceFilter,setFaceFilter]=useState(initialTarget.faceId ? `face-id:${initialTarget.faceId}` : initialTarget.faceLabel ?? "");
 const [phaseFilter,setPhaseFilter]=useState("");
 const [links,setLinks]=useState<PhotoContext[]>([]);
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState<string>();
 const [error,setError]=useState<string>();
 const [busy,setBusy]=useState(false);
 const [uploadBusy,setUploadBusy]=useState(false);
 const [uploadPending,setUploadPending]=useState(false);
 const [mode,setMode]=useState<"browse"|"existing"|"upload">(initialTarget.mode ?? "browse");
 const [photoId,setPhotoId]=useState("");
 const [faceId,setFaceId]=useState("");
 const [phase,setPhase]=useState<PhotoContext["phase"]>("unspecified");
 const [message,setMessage]=useState<string>();
 const requestSequence=useRef(0);
 const editorRef=useRef<HTMLElement>(null);
 const uploadRef=useRef<HTMLFieldSetElement>(null);
 const uploadFocused=useRef(false);
 useEffect(()=>{
  if(initialTarget.mode!=="upload"||mode!=="upload"||loading||loadError||uploadFocused.current||!uploadRef.current)return;
  const input=uploadRef.current.querySelector<HTMLInputElement>('input[type="file"]');
  if(input){uploadFocused.current=true;uploadRef.current.scrollIntoView({block:"nearest"});input.focus({preventScroll:true});}
 },[initialTarget.mode,mode,loading,loadError]);
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  const request=++requestSequence.current;
  setLoading(true);setLoadError(undefined);
  try {
   const result=await fetchPhotoContexts(headstone.id,signal);
   if(!signal?.aborted&&request===requestSequence.current)setLinks(result);
  } catch(cause) {
   if(!signal?.aborted&&request===requestSequence.current)setLoadError(cause instanceof Error?cause.message:"Unable to load photo associations.");
  } finally {
   if(!signal?.aborted&&request===requestSequence.current)setLoading(false);
  }
 },[headstone.id]);
 const invalidateRequests=useCallback(()=>{requestSequence.current++;},[]);
 useEffect(()=>{const controller=new AbortController();void refresh(controller.signal);return()=>{controller.abort();invalidateRequests();};},[refresh,headstone.mediaAssets,invalidateRequests]);
 const inspectionId=record.startsWith("inspection:")?record.slice(11):undefined;
 const maintenanceRecordId=record.startsWith("maintenance:")?record.slice(12):undefined;
 const inspection=headstone.inspections?.find(entry=>entry.id===inspectionId);
 const faces=inspection?.faces ?? headstone.faces ?? [];
 const assets=(headstone.mediaAssets ?? []).filter(asset=>asset.assetType==="photo");
 const matches=(link:PhotoContext)=>inspectionId?link.inspectionId===inspectionId:maintenanceRecordId?link.maintenanceRecordId===maintenanceRecordId:true;
 const selectedLink=links.find(link=>link.mediaAssetId===photoId&&matches(link));
 const recordSelected=Boolean(inspectionId||maintenanceRecordId);
 const canEdit=inspectionId?canEditInspections:canUpdate;
 const linkDirty=Boolean(recordSelected&&photoId&&(!selectedLink||(selectedLink.faceId||undefined)!==(faceId||undefined)||selectedLink.phase!==phase));
 const confirmLeave=()=>!uploadPending&&!linkDirty||window.confirm("Discard unsaved photo selections and changes?");
 const close=()=>{if(!busy&&!uploadBusy&&confirmLeave())onClose();};
 const recordLabel=(link:Pick<PhotoContext,"inspectionId"|"maintenanceRecordId">)=>{
  if(link.inspectionId){const visit=headstone.inspections?.find(entry=>entry.id===link.inspectionId);return visit?`Inspection: ${visit.inspectedAt?formatDate(visit.inspectedAt):visit.inspectionYear} · ${visit.source}`:"Inspection unavailable";}
  const action=headstone.maintenanceRecords?.find(entry=>entry.id===link.maintenanceRecordId);
  return action?`Maintenance: ${action.actionType?.label||action.issueType?.label||"Work record"} · ${formatDate(action.observedAt)}`:"Maintenance record unavailable";
 };
 const destinationLabel=recordSelected?recordLabel({inspectionId,maintenanceRecordId}):record==="unlinked"?"Photos without a record":"All marker photos";
 const faceLabel=(link:PhotoContext)=>{
  const snapshot=link.inspectionId?headstone.inspections?.find(entry=>entry.id===link.inspectionId)?.faces:headstone.faces;
  return snapshot?.find(face=>face.id===link.faceId)?.label || (link.faceId?"Face unavailable":"Face not specified");
 };
 const faceOptions=[...new Set([
  ...(headstone.faces??[]).map(face=>face.label),
  ...links.filter(link=>mode==="existing"||matches(link)).filter(link=>link.faceId).map(faceLabel),
 ])];
 const faceMatches=(link:PhotoContext)=>!faceFilter || (faceFilter.startsWith("face-id:") ? link.faceId===faceFilter.slice(8) : faceLabel(link)===faceFilter);
 const browseAll=record==="all"||(mode==="existing"&&recordSelected);
 const visible=assets.filter(asset=>{
  const associations=links.filter(link=>link.mediaAssetId===asset.id);
  const markerFaceMatch=headstone.faces?.some(face=>face.label===faceFilter&&face.mediaAssetIds?.includes(asset.id));
  if(record==="unlinked")return !associations.length&&(!faceFilter||markerFaceMatch)&&!phaseFilter;
  if(browseAll&&faceFilter&&markerFaceMatch&&!phaseFilter)return true;
  if(browseAll&&!faceFilter&&!phaseFilter)return true;
  return associations.some(link=>(browseAll||matches(link))&&faceMatches(link)&&(!phaseFilter||(Boolean(link.maintenanceRecordId)&&link.phase===phaseFilter)));
 });
 const choosePhoto=(id:string)=>{
  const saved=links.find(link=>link.mediaAssetId===id&&matches(link));
  setPhotoId(id);setFaceId(saved?.faceId||"");setPhase(saved?.phase||"unspecified");setError(undefined);setMessage(undefined);
 };
 const changeLink=async(id:string,remove=false)=>{
  if(!recordSelected||!canEdit||busy||uploadBusy)return;
  setBusy(true);setError(undefined);setMessage(undefined);
  try {
   // Unlink only the chosen record; another record's face and timing are independent.
   await savePhotoContext(headstone.id,id,{inspectionId,maintenanceRecordId,faceId:remove?undefined:faceId||undefined,phase:maintenanceRecordId?phase:"unspecified"},remove);
   setPhotoId("");setFaceId("");setPhase("unspecified");setMode("browse");
   setMessage(remove?"Photo unlinked. It remains in the marker gallery.":"Photo linked to the selected record.");
   await refresh();
  } catch(cause){setError(cause instanceof Error?cause.message:"Unable to update photo link.");}
  finally{setBusy(false);}
 };
 return <Modal className="media-gallery-modal monument-photo-workspace" label="Marker photo gallery" onClose={close}>
  <header><div><h3>Marker photo gallery</h3><p>{headstone.headstoneId} · {assets.length} photos</p><p className="photo-workspace-target" title={destinationLabel}>{destinationLabel}</p></div><button type="button" disabled={busy||uploadBusy} onClick={close}>Close gallery</button></header>
  <fieldset className="photo-gallery-filters" disabled={busy||uploadBusy}>
   <legend>Browse photos</legend>
   <label>Photo record<select value={record} onChange={event=>{
    if(!confirmLeave())return;
    setRecord(event.target.value);setUploadPending(false);setMode("browse");setPhotoId("");setFaceId("");setPhase("unspecified");setFaceFilter("");setPhaseFilter("");setError(undefined);setMessage(undefined);
   }}>
    <option value="all">All marker photos</option><option value="unlinked">Photos without a record</option>
    {(headstone.inspections??[]).map(entry=><option key={entry.id} value={`inspection:${entry.id}`}>Inspection: {entry.inspectedAt?formatDate(entry.inspectedAt):entry.inspectionYear} · {entry.source}</option>)}
    {(headstone.maintenanceRecords??[]).map(entry=><option key={entry.id} value={`maintenance:${entry.id}`}>Maintenance: {entry.actionType?.label||entry.issueType?.label||"Work record"} · {formatDate(entry.observedAt)}</option>)}
   </select></label>
   <label>Filter by face<select value={faceFilter} onChange={event=>setFaceFilter(event.target.value)}><option value="">All faces</option>{initialTarget.faceId?<option value={`face-id:${initialTarget.faceId}`}>{faces.find(face=>face.id===initialTarget.faceId)?.label||"Selected face"} (selected face)</option>:null}{faceOptions.map(label=><option key={label} value={label}>{label}</option>)}</select></label>
   {!inspectionId&&record!=="unlinked"?<label>Filter by maintenance timing<select value={phaseFilter} onChange={event=>setPhaseFilter(event.target.value)}><option value="">All timings</option>{Object.entries(timingLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>:null}
  </fieldset>
  {loadError?<div role="alert"><p>{loadError}</p><button type="button" onClick={()=>void refresh()}>Retry photo associations</button></div>:null}
  {loading?<p role="status">Refreshing photo associations…</p>:null}
  {mode==="existing"&&recordSelected?<p className="muted">Showing all marker photos so you can choose one to link to the selected record.</p>:null}
  {canEdit?<section ref={editorRef} className="photo-gallery-editor" aria-label="Photo controls">
   <h4>Add or link photos</h4>
   <p className="muted">{recordSelected?`Photos will be linked to ${destinationLabel}. ${maintenanceRecordId?"Face and timing":"Face"} below ${maintenanceRecordId?"apply":"applies"} to both uploads and existing photos.`:"Uploads go into the marker gallery. Select an inspection or maintenance record above to link photos to it."}</p>
   <fieldset disabled={busy||uploadBusy||loading||Boolean(loadError)} className="record-photo-editor">
    <legend>{recordSelected?"Photo association":"Marker photos"}</legend>
    <div className="photo-control-modes"><button type="button" aria-pressed={mode==="existing"} disabled={!recordSelected} onClick={()=>{if(confirmLeave()){setMode("existing");setUploadPending(false);choosePhoto("");}}}>Choose existing photos</button><button type="button" aria-pressed={mode==="upload"} onClick={()=>{if(confirmLeave()){setMode("upload");setUploadPending(false);choosePhoto("");}}}>Upload new photos</button></div>
    {mode!=="browse"&&recordSelected?<PhotoContextFields faces={faces} faceId={faceId} onFaceChange={setFaceId} maintenance={Boolean(maintenanceRecordId)} phase={phase} onPhaseChange={setPhase} />:null}
    {mode==="existing"&&recordSelected?<>
     <p className="muted">Choose Link to this record or Edit photo link on a photo in the gallery.</p>
     {photoId&&assets.some(asset=>asset.id===photoId)?<div className="record-photo-selected"><PhotoThumbnail asset={assets.find(asset=>asset.id===photoId)!} /><span>{assets.find(asset=>asset.id===photoId)?.originalFilename || "Monument photo"}</span></div>:null}
     <div className="headstone-form-actions"><button type="button" className="secondary-button" onClick={()=>{choosePhoto("");setMessage(undefined);}}>Cancel photo changes</button><button type="button" className="photo-link-save" disabled={!photoId} onClick={()=>void changeLink(photoId)}>Save photo link</button></div>
    </>:null}
   </fieldset>
   {/* Keep uploads outside the association fieldset: the form owns its own busy state. */}
   {mode==="upload"?<fieldset ref={uploadRef} className="photo-upload-fields" disabled={busy||loading||Boolean(loadError)}><legend>Upload new photos</legend><PhotoUploadForm key={record} fixedHeadstone={headstone} photoContext={{inspectionId,maintenanceRecordId,faceId:faceId||undefined,phase:maintenanceRecordId?phase:"unspecified"}} onPendingChange={setUploadPending} onBusyChange={setUploadBusy} onUpload={async input=>{await onUpload(input);await refresh();}} /></fieldset>:null}
  </section>:null}
  <div aria-busy={loading}>
   <MediaGallery assets={visible} showAll emptyMessage={loading?"Loading photos…":loadError?"Photo associations are unavailable. Retry to browse this record.":"No photos match these filters."} canDelete={canDelete} onDelete={onDelete} onMove={onMove}
    renderDetails={asset=><div className="photo-context-labels">{headstone.faces?.filter(face=>face.mediaAssetIds?.includes(asset.id)).map(face=><p key={`face-${face.id}`}>Marker face: {face.label}</p>)}{links.filter(link=>link.mediaAssetId===asset.id).map(link=><p key={link.id}>{recordLabel(link)} · {faceLabel(link)}{link.maintenanceRecordId?` · ${timingLabels[link.phase]}`:""}</p>)}{!loading&&!loadError&&!links.some(link=>link.mediaAssetId===asset.id)?<p>No inspection or maintenance record</p>:null}</div>}
    renderActions={asset=>recordSelected&&canEdit&&!loadError?<div className="record-photo-actions">
     <button type="button" disabled={busy||uploadBusy||loading} onClick={()=>{if(confirmLeave()){setMode("existing");choosePhoto(asset.id);requestAnimationFrame(()=>{editorRef.current?.scrollIntoView({block:"start"});editorRef.current?.querySelector<HTMLSelectElement>("select")?.focus({preventScroll:true});});}}}>{links.some(link=>link.mediaAssetId===asset.id&&matches(link))?"Edit photo link":"Link to this record"}</button>
     {links.some(link=>link.mediaAssetId===asset.id&&matches(link))?<button type="button" disabled={busy||uploadBusy||loading} onClick={()=>void changeLink(asset.id,true)}>Unlink from this record</button>:null}
    </div>:null} />
  </div>
  {message?<p role="status">{message}</p>:null}
  {error?<p role="alert">{error}</p>:null}
 </Modal>;
}
