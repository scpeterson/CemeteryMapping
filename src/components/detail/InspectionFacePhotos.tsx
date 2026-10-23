import { useState } from "react";
import type { MediaAsset } from "../../types";
import { FilePreview, PhotoLibraryPicker } from "./PhotoControls";

import type { PhotoContext } from "../../api/mediaApi";
import { MediaPhoto } from "./MediaPhoto";

import { inspectionFacePhotos, type InspectionPhotoDraft } from "../../lib/inspectionPhotos";
import { formatDate } from "../../lib/format";
export type { InspectionPhotoDraft } from "../../lib/inspectionPhotos";

export function InspectionFacePhotos({faceId,photos,assets,onChange,linkedPhotos=[],linkedLoading=false,linkedUnavailable=false,onManageLinked,canUpload=true}: {
  canUpload?:boolean; linkedPhotos?:PhotoContext[]; linkedLoading?:boolean; linkedUnavailable?:boolean; onManageLinked?:()=>void;
  faceId:string; photos:InspectionPhotoDraft[]; assets:MediaAsset[]; onChange:(photos:InspectionPhotoDraft[])=>void;
}) {
  const [error,setError]=useState<string>();
  const {own,linkedAssets,linkedOnly}=inspectionFacePhotos(faceId,photos,assets,linkedPhotos);
  const update=(id:string,value:Partial<InspectionPhotoDraft>)=>onChange(photos.map(p=>p.id===id?{...p,...value}:p));
  return <section aria-label="Photos for this face" className="record-photos">
    <h5>Photos for this face</h5>
    {canUpload?<label>Choose photos to upload<input type="file" accept="image/*" multiple onChange={event=>{
      const files=Array.from(event.target.files??[]);
      if(files.some(file=>file.size>25*1024*1024)){setError("Each photo must be 25 MB or smaller.");event.target.value="";return;}
      setError(undefined);
      onChange([...photos,...files.map(file=>({id:crypto.randomUUID(),faceId,file,notes:"",capturedAt:""}))]);
      event.target.value="";
    }} /></label>:null}
    <p className="muted">Photos will be uploaded and linked to this face when you save the inspection.</p>
    {error?<p role="alert" className="detail-message is-error">{error}</p>:null}
    {linkedLoading?<p role="status">Loading linked photos…</p>:linkedUnavailable?<p className="muted">Linked photos are unavailable. Use Retry linked photo counts above to try again.</p>:null}
    {linkedOnly.map(asset=><fieldset key={asset.id} className="record-photo-editor" aria-label={`Photo ${asset.originalFilename||"Monument photo"}`}>
      <legend>{asset.originalFilename||"Monument photo"}</legend>
      <MediaPhoto asset={asset}><span>Already linked to this inspection and face</span></MediaPhoto>
      {onManageLinked?<button type="button" className="secondary-button" onClick={onManageLinked}>Manage photo link</button>:null}
    </fieldset>)}
    {onManageLinked&&linkedOnly.length?<p className="muted">Manage photo link opens the saved-photo gallery. Changes there are saved separately from this inspection draft.</p>:null}
    {own.map(photo=>{
      const asset=assets.find(a=>a.id===photo.mediaAssetId);
      return <fieldset key={photo.id} className="record-photo-editor" aria-label={`Photo ${photo.file?.name||asset?.originalFilename||"Monument photo"}`}>
        <legend>{photo.file?.name||asset?.originalFilename||"Monument photo"}</legend>
        {photo.file?<FilePreview file={photo.file} />:asset?<MediaPhoto asset={asset}><span>{linkedAssets.some(linked=>linked.id===asset.id)?"Already linked · selected in this draft":"Selected in this draft"}</span></MediaPhoto>:null}
        {photo.file?<>
          <label>Notes<input value={photo.notes} maxLength={4000} disabled={photo.saved} onChange={event=>update(photo.id,{notes:event.target.value})} /></label>
          <label>Date taken<input type="date" value={photo.capturedAt} disabled={photo.saved} onChange={event=>update(photo.id,{capturedAt:event.target.value})} /></label>
          <p className="muted">Leave the date empty to use the photo’s captured date when available.</p>
        </>:null}
        {asset&&linkedAssets.some(linked=>linked.id===asset.id)&&onManageLinked?<button type="button" className="secondary-button" onClick={onManageLinked}>Manage photo link</button>:null}
        {photo.saved?<p role="status">Photo saved and linked.</p>:<button type="button" className="secondary-button" onClick={()=>onChange(photos.filter(p=>p.id!==photo.id))}>Remove selected photo</button>}
      </fieldset>;
    })}
    {assets.length?<details><summary>Choose existing photos</summary>
      <PhotoLibraryPicker assets={assets} selected={asset=>photos.some(photo=>photo.mediaAssetId===asset.id)} disabled={asset=>photos.some(photo=>photo.mediaAssetId===asset.id)} status={asset=>{const chosen=photos.find(photo=>photo.mediaAssetId===asset.id);return chosen?(chosen.faceId===faceId?"Selected for this face":"Selected for another face"):undefined;}} onSelect={asset=>onChange([...photos,{id:crypto.randomUUID(),faceId,mediaAssetId:asset.id,notes:"",capturedAt:""}])} />
    </details>:null}
  </section>;
}


export function InspectionFacePhotoReview({faceId,faceLabel,photos,assets,linkedPhotos,includeLinked,loading,unavailable,onRetry}: {
  faceId:string; faceLabel:string; photos:InspectionPhotoDraft[]; assets:MediaAsset[]; linkedPhotos:PhotoContext[];
  includeLinked:boolean; loading:boolean; unavailable:boolean; onRetry:()=>void;
}) {
  const {own,linkedOnly,linkedAssets,selectedCount,linkedCount,total}=inspectionFacePhotos(faceId,photos,assets,linkedPhotos);
  const entries = [
    ...linkedOnly.map(asset=>({id:`linked-${asset.id}`,asset,photo:undefined as InspectionPhotoDraft|undefined})),
    ...own.map(photo=>({id:photo.id,asset:assets.find(asset=>asset.id===photo.mediaAssetId),photo})),
  ];
  return <section className="inspection-face-photo-review" aria-label={`Photos for ${faceLabel}`}>
    {includeLinked&&loading?<p className="muted">Loading linked photos… {selectedCount} photos selected in this draft.</p>
      :includeLinked&&unavailable?<p className="muted">Linked photos are unavailable. {selectedCount} photos selected in this draft. <button type="button" className="secondary-button" onClick={onRetry}>Retry linked photo counts</button></p>
      :<p className="muted">{total} {total===1?"photo":"photos"} total · {linkedCount} linked · {selectedCount} selected</p>}
    {!entries.length&&!loading&&!unavailable?<p className="muted">No photos for this face.</p>:null}
    <ul className="inspection-review-photos">{entries.map(({id,asset,photo})=>{
      const linked=asset&&linkedAssets.some(link=>link.id===asset.id);
      const filename=photo?.file?.name||asset?.originalFilename||"Monument photo";
      const notes=photo?.file?photo.notes:asset?.notes;
      const capturedAt=photo?.file?photo.capturedAt:asset?.capturedAt;
      return <li key={id} className="inspection-review-photo">
        <strong>{filename}</strong>
        {photo?.file?<FilePreview file={photo.file}/>:asset?<MediaPhoto asset={asset}>{null}</MediaPhoto>:<p className="muted">Preview unavailable.</p>}
        <span>{linked?(photo?"Already linked · selected in this draft":"Already linked to this inspection and face"):"Selected in this draft"}</span>
        {notes?<p>{notes}</p>:null}
        {capturedAt?<p>Date taken: {formatDate(capturedAt)}</p>:null}
      </li>;
    })}</ul>
  </section>;
}
