import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import type { Headstone, InspectionFace } from "../../types";
import { fetchPhotoContexts, savePhotoContext } from "../../api/mediaApi";
import type { PhotoContext } from "../../api/mediaApi";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { useNearViewport } from "../../hooks/useNearViewport";
import type { MediaAsset } from "../../types";
import { MediaGallery, PhotoUploadForm } from "./MediaRecords";

export function PhotoThumbnail({asset}: {asset: MediaAsset}) {
 const {ref,active}=useNearViewport();
 const {url,failed,retry,reportImageFailure}=useMediaUrl(asset.thumbnailUrl||asset.fileUrl,active);
 return <span className="record-photo-thumbnail" ref={ref}>
  {url&&!failed?<img src={url} alt="" onError={reportImageFailure} />:failed?<button type="button" onClick={retry}>Retry thumbnail</button>:<span>Loading photo…</span>}
 </span>;
}
const timingLabels={unspecified:"Not recorded",before:"Before maintenance",during:"During maintenance",after:"After maintenance"};

type Upload = ComponentProps<typeof PhotoUploadForm>["onUpload"];
export function RecordPhotos({ headstone, inspectionId, maintenanceRecordId, faces: suppliedFaces, canUpdate = false, onUpload }: {
 headstone: Headstone; faces?: InspectionFace[]; inspectionId?: string; maintenanceRecordId?: string; faceId?: string; canUpdate?: boolean; onUpload?: Upload;
}) {
 const editorRef=useRef<HTMLFieldSetElement>(null);
 const [links,setLinks]=useState<PhotoContext[]>([]);
 const faces=suppliedFaces ?? headstone.faces ?? [];
 const [faceId,setFaceId]=useState("");
 const [photoId,setPhotoId]=useState("");
 const [phase,setPhase]=useState<PhotoContext["phase"]>("unspecified");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string>();
 const [loading,setLoading]=useState(true);
 const label=inspectionId?"Inspection photos":"Maintenance photos";
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError(undefined);setPhotoId("");setFaceId("");setPhase("unspecified");
  fetchPhotoContexts(headstone.id,controller.signal).then(value=>{setLinks(value);setLoading(false);}).catch(cause=>{
   if(!controller.signal.aborted){setError(cause instanceof Error?cause.message:"Unable to load record photos.");setLoading(false);}
  });
  return ()=>controller.abort();
 },[headstone.id,headstone.mediaAssets,inspectionId,maintenanceRecordId]);
 const target={inspectionId,maintenanceRecordId,faceId:faceId||undefined};
 const matches=links.filter(link=>inspectionId?link.inspectionId===inspectionId:link.maintenanceRecordId===maintenanceRecordId);
 const assets=(headstone.mediaAssets??[]).filter(asset=>asset.assetType==="photo");
 const selectedAsset=assets.find(asset=>asset.id===photoId);
 const linked=assets.filter(asset=>matches.some(link=>link.mediaAssetId===asset.id)).map(asset=>{
  const entry=matches.find(link=>link.mediaAssetId===asset.id)!;
  const face=faces.find(face=>face.id===entry.faceId);
  const phaseNotes=entry.phase==="unspecified"?asset.notes:`${entry.phase[0].toUpperCase()+entry.phase.slice(1)} · ${asset.notes||asset.originalFilename}`;
  return {...asset,notes:face?`${face.label} · ${phaseNotes||asset.originalFilename}`:entry.faceId?`Face unavailable · ${phaseNotes||asset.originalFilename}`:entry.phase==="unspecified"?asset.notes:`${entry.phase[0].toUpperCase()+entry.phase.slice(1)} · ${asset.notes||asset.originalFilename}`};
 });
 const choosePhoto=(id:string)=>{
  setPhotoId(id);
  const current=matches.find(link=>link.mediaAssetId===id);
  setFaceId(current?.faceId||"");setPhase(current?.phase||"unspecified");
 };
 const changeLink=async(id:string,remove=false)=>{
  setBusy(true);setError(undefined);
  try{await savePhotoContext(headstone.id,id,{...target,phase},remove);setLinks(await fetchPhotoContexts(headstone.id));setPhotoId("");}
  catch(cause){setError(cause instanceof Error?cause.message:"Unable to update photo link.");}
  finally{setBusy(false);}
 };
 return <section className="record-photos" aria-label={label}>
  <h5>{label}</h5>
  <div aria-busy={loading}>
   <MediaGallery assets={linked} emptyMessage={loading?"Loading record photos…":"No photos recorded."} />
  </div>
  {error?<p role="alert" className="detail-message is-error">{error}</p>:null}
  {canUpdate?<details><summary>Add photos to this record</summary>
   <div className="record-photo-links" aria-label="Linked photos">
   {matches.filter(link=>assets.some(asset=>asset.id===link.mediaAssetId)).map(link=>{
    const asset=assets.find(asset=>asset.id===link.mediaAssetId)!;
    return <div className="record-photo-link" key={link.id}>
     <PhotoThumbnail asset={asset} />
     <div className="record-photo-link-info">
      <strong className="record-photo-filename">{asset.originalFilename||"Monument photo"}</strong>
      <dl><div><dt>Face</dt><dd>{faces.find(f=>f.id===link.faceId)?.label || "Not recorded"}</dd></div>
       {maintenanceRecordId?<div><dt>Maintenance timing</dt><dd>{timingLabels[link.phase]}</dd></div>:null}
      </dl>
      <div className="headstone-form-actions record-photo-actions">
       <button type="button" className="secondary-button" disabled={busy} onClick={()=>{choosePhoto(link.mediaAssetId);editorRef.current?.scrollIntoView({block:"nearest",behavior:"smooth"});}}>Edit photo link</button>
       <button type="button" className="secondary-button" disabled={busy} onClick={()=>void changeLink(link.mediaAssetId,true)}>Unlink from this record</button>
      </div>
     </div>
    </div>;
   })}
   </div>
    <fieldset ref={editorRef} disabled={busy||loading} className="record-photo-editor">
     <legend>Choose a monument photo</legend>
     <details className="record-photo-picker"><summary>Browse photo thumbnails</summary>
      <div className="record-photo-choices">
       {assets.map(asset=><div className="record-photo-choice" key={asset.id}>
        <PhotoThumbnail asset={asset} />
        <button type="button" aria-pressed={photoId===asset.id} aria-label={`Select photo ${asset.originalFilename||asset.id}`} onClick={()=>choosePhoto(asset.id)}>
         {photoId===asset.id?"Selected: ":"Select: "}{asset.originalFilename||"Monument photo"}
        </button>
        {matches.some(link=>link.mediaAssetId===asset.id)?<span className="muted">Already linked to this record</span>:null}
       </div>)}
      </div>
     </details>
     <label>Existing monument photo<select value={photoId} onChange={event=>choosePhoto(event.target.value)}>
      <option value="">Choose photo</option>{assets.map(asset=><option key={asset.id} value={asset.id}>{asset.originalFilename||asset.notes||"Photo"}{matches.some(link=>link.mediaAssetId===asset.id)?" (linked)":""}</option>)}
     </select></label>
     {selectedAsset?<div className="record-photo-selected" aria-label="Selected photo preview"><PhotoThumbnail asset={selectedAsset} /><span>{selectedAsset.originalFilename}</span></div>:null}
     <label>Photo face<select value={faceId} onChange={event=>setFaceId(event.target.value)}>
      <option value="">Face not specified</option>{faces.map(face=><option key={face.id} value={face.id}>{face.label}</option>)}
     </select></label>
     {maintenanceRecordId?<label>Maintenance timing<select value={phase} onChange={event=>setPhase(event.target.value as typeof phase)}>
      <option value="unspecified">Not recorded</option><option value="before">Before maintenance</option><option value="during">During maintenance</option><option value="after">After maintenance</option>
     </select></label>:null}
     <div className="headstone-form-actions">
      <button type="button" className="secondary-button" onClick={()=>{choosePhoto("");setError(undefined);}}>Cancel</button>
      <button type="button" disabled={!photoId} onClick={()=>void changeLink(photoId)}>Save photo link</button>
     </div>
    </fieldset>
    <p className="muted">Linking reuses the existing photo. Unlinking keeps it in All monument photos.</p>
    <p className="muted">Face identifies the side of the monument shown. The selected face also applies to uploads below.</p>
    {onUpload?<PhotoUploadForm key={`${inspectionId||maintenanceRecordId}`} fixedHeadstone={headstone} photoContext={target} onUpload={async input=>{
     await onUpload(input);setLinks(await fetchPhotoContexts(headstone.id));
    }} />:null}
   </details>:null}
 </section>;
}
