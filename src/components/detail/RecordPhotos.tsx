import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import type { Headstone, InspectionFace } from "../../types";
import { fetchPhotoContexts, savePhotoContext } from "../../api/mediaApi";
import type { PhotoContext } from "../../api/mediaApi";
import { MediaGallery, PhotoUploadForm } from "./MediaRecords";

type Upload = ComponentProps<typeof PhotoUploadForm>["onUpload"];
export function RecordPhotos({ headstone, inspectionId, maintenanceRecordId, faces: suppliedFaces, canUpdate = false, onUpload }: {
 headstone: Headstone; faces?: InspectionFace[]; inspectionId?: string; maintenanceRecordId?: string; faceId?: string; canUpdate?: boolean; onUpload?: Upload;
}) {
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
 const linked=assets.filter(asset=>matches.some(link=>link.mediaAssetId===asset.id)).map(asset=>{
  const entry=matches.find(link=>link.mediaAssetId===asset.id)!;
  const face=faces.find(face=>face.id===entry.faceId);
  const phaseNotes=entry.phase==="unspecified"?asset.notes:`${entry.phase[0].toUpperCase()+entry.phase.slice(1)} · ${asset.notes||asset.originalFilename}`;
  return {...asset,notes:face?`${face.label} · ${phaseNotes||asset.originalFilename}`:entry.faceId?`Face unavailable · ${phaseNotes||asset.originalFilename}`:entry.phase==="unspecified"?asset.notes:`${entry.phase[0].toUpperCase()+entry.phase.slice(1)} · ${asset.notes||asset.originalFilename}`};
 });
 const changeLink=async(id:string,remove=false)=>{
  setBusy(true);setError(undefined);
  try{await savePhotoContext(headstone.id,id,{...target,phase},remove);setLinks(await fetchPhotoContexts(headstone.id));setPhotoId("");}
  catch(cause){setError(cause instanceof Error?cause.message:"Unable to update photo link.");}
  finally{setBusy(false);}
 };
 return <section className="record-photos" aria-label={label}>
  <h5>{label}</h5>
  {loading?<p className="muted">Loading record photos…</p>:<MediaGallery assets={linked} emptyMessage="No photos recorded." />}
  {error?<p role="alert" className="detail-message is-error">{error}</p>:null}
  {canUpdate?<details><summary>Add photos to this record</summary>
   {matches.filter(link=>assets.some(asset=>asset.id===link.mediaAssetId)).map(link=><p key={link.id}>
    {assets.find(asset=>asset.id===link.mediaAssetId)?.originalFilename||"Photo"} · {link.phase} · {faces.find(f=>f.id===link.faceId)?.label || "Face not specified"}
    <button type="button" className="secondary-button" disabled={busy} onClick={()=>void changeLink(link.mediaAssetId,true)}>Unlink from this record</button>
   </p>)}
    <fieldset disabled={busy||loading}>
     <legend>Use a monument photo</legend>
     <label>Existing monument photo<select value={photoId} onChange={event=>setPhotoId(event.target.value)}>
      <option value="">Choose photo</option>{assets.map(asset=><option key={asset.id} value={asset.id}>{asset.originalFilename||asset.notes||"Photo"}{matches.some(link=>link.mediaAssetId===asset.id)?" (linked)":""}</option>)}
     </select></label>
     <label>Photo face<select value={faceId} onChange={event=>setFaceId(event.target.value)}>
      <option value="">Face not specified</option>{faces.map(face=><option key={face.id} value={face.id}>{face.label}</option>)}
     </select></label>
     <label>Photo phase<select value={phase} onChange={event=>setPhase(event.target.value as typeof phase)}>
      <option value="unspecified">Not specified</option><option value="before">Before</option><option value="during">During</option><option value="after">After</option>
     </select></label>
     <button type="button" disabled={!photoId} onClick={()=>void changeLink(photoId)}>Save photo link</button>
    </fieldset>
    <p className="muted">Linking reuses the existing photo. Unlinking keeps it in All monument photos.</p>
    <p className="muted">The selected photo face also applies to uploads below. Choose an existing photo and save its link to change its face label.</p>
    {onUpload?<PhotoUploadForm key={`${inspectionId||maintenanceRecordId}`} fixedHeadstone={headstone} photoContext={target} onUpload={async input=>{
     await onUpload(input);setLinks(await fetchPhotoContexts(headstone.id));
    }} />:null}
   </details>:null}
 </section>;
}
