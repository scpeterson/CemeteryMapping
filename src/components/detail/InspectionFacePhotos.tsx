import { useEffect, useState } from "react";
import type { MediaAsset } from "../../types";
import { PhotoThumbnail } from "./RecordPhotos";

export type InspectionPhotoDraft = {
  id: string; faceId: string; file?: File; mediaAssetId?: string;
  notes: string; capturedAt: string; saved?: boolean;
};

function FilePreview({file}: {file: File}) {
  const [url,setUrl]=useState<string>();
  useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next);},[file]);
  return url?<span className="record-photo-thumbnail"><img src={url} alt={`Preview of ${file.name}`} /></span>:null;
}

export function InspectionFacePhotos({faceId,photos,assets,onChange}: {
  faceId:string; photos:InspectionPhotoDraft[]; assets:MediaAsset[]; onChange:(photos:InspectionPhotoDraft[])=>void;
}) {
  const [error,setError]=useState<string>();
  const own=photos.filter(photo=>photo.faceId===faceId);
  const update=(id:string,value:Partial<InspectionPhotoDraft>)=>onChange(photos.map(p=>p.id===id?{...p,...value}:p));
  return <section aria-label="Photos for this face" className="record-photos">
    <h5>Photos for this face</h5>
    <label>Choose photos to upload<input type="file" accept="image/*" multiple onChange={event=>{
      const files=Array.from(event.target.files??[]);
      if(files.some(file=>file.size>25*1024*1024)){setError("Each photo must be 25 MB or smaller.");event.target.value="";return;}
      setError(undefined);
      onChange([...photos,...files.map(file=>({id:crypto.randomUUID(),faceId,file,notes:"",capturedAt:""}))]);
      event.target.value="";
    }} /></label>
    <p className="muted">Photos will be uploaded and linked to this face when you save the inspection.</p>
    {error?<p role="alert" className="detail-message is-error">{error}</p>:null}
    {own.map(photo=>{
      const asset=assets.find(a=>a.id===photo.mediaAssetId);
      return <fieldset key={photo.id} className="record-photo-editor" aria-label={`Photo ${photo.file?.name||asset?.originalFilename||"Monument photo"}`}>
        <legend>{photo.file?.name||asset?.originalFilename||"Monument photo"}</legend>
        {photo.file?<FilePreview file={photo.file} />:asset?<PhotoThumbnail asset={asset} />:null}
        {photo.file?<>
          <label>Photo notes<input value={photo.notes} maxLength={4000} disabled={photo.saved} onChange={event=>update(photo.id,{notes:event.target.value})} /></label>
          <label>Photo date<input type="date" value={photo.capturedAt} disabled={photo.saved} onChange={event=>update(photo.id,{capturedAt:event.target.value})} /></label>
          <p className="muted">Leave the date empty to use the photo’s captured date when available.</p>
        </>:null}
        {photo.saved?<p role="status">Photo saved and linked.</p>:<button type="button" className="secondary-button" onClick={()=>onChange(photos.filter(p=>p.id!==photo.id))}>Remove selected photo</button>}
      </fieldset>;
    })}
    {assets.length?<details><summary>Choose existing monument photos</summary>
      <div className="record-photo-choices">
        {assets.map(asset=>{
          const chosen=photos.find(p=>p.mediaAssetId===asset.id);
          return <div key={asset.id} className="record-photo-choice">
            <PhotoThumbnail asset={asset} />
            <button type="button" aria-pressed={chosen?.faceId===faceId} disabled={Boolean(chosen)} aria-label={`Use photo ${asset.originalFilename||asset.id}`} onClick={()=>onChange([...photos,{id:crypto.randomUUID(),faceId,mediaAssetId:asset.id,notes:"",capturedAt:""}])}>
              {chosen?chosen.faceId===faceId?"Selected for this face: ":"Selected for another face: ":"Use: "}{asset.originalFilename||"Monument photo"}
            </button>
          </div>;
        })}
      </div>
    </details>:null}
  </section>;
}
