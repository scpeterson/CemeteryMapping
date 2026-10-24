import { useEffect, useState } from "react";
import type { MediaAsset } from "../../types";
import type { PhotoContext } from "../../api/mediaApi";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { useNearViewport } from "../../hooks/useNearViewport";

import { Modal } from "../ui/Modal";

import { timingLabels } from "./photoLabels";

export function PhotoThumbnail({asset}: {asset: MediaAsset}) {
 const {ref,active}=useNearViewport();
 const {url,failed,retry,reportImageFailure}=useMediaUrl(asset.thumbnailUrl||asset.fileUrl,active);
 return <span className="record-photo-thumbnail" ref={ref}>
  {url&&!failed?<img src={url} alt="" onError={reportImageFailure} />:failed?<button type="button" onClick={retry}>Retry thumbnail</button>:<span>Loading photo…</span>}
 </span>;
}

export function FilePreview({file}: {file: File}) {
 const [url,setUrl]=useState<string>();
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next);},[file]);
 return url?<><a className="record-photo-thumbnail" href={url} aria-label={`Open photo: ${file.name}`} onClick={event=>{event.preventDefault();setExpanded(true);}}><img src={url} alt={`Preview of ${file.name}`} /></a>
  {expanded?<Modal className="overview-photo-dialog" label="Record photo" onClose={()=>setExpanded(false)}><button type="button" onClick={()=>setExpanded(false)}>Close photo</button><img src={url} alt={`Preview of ${file.name}`} /></Modal>:null}
 </>:null;
}

export function PhotoLibraryPicker({assets, selected, onSelect, disabled, status}: {
 assets: MediaAsset[]; selected: (asset: MediaAsset) => boolean; onSelect: (asset: MediaAsset) => void; disabled?: (asset: MediaAsset) => boolean; status?: (asset: MediaAsset) => string | undefined;
}) {
 return <div className="record-photo-choices">{assets.map(asset => <div key={asset.id} className="record-photo-choice">
  <PhotoThumbnail asset={asset} />
  <button type="button" aria-pressed={selected(asset)} disabled={disabled?.(asset)} aria-label={`Select photo ${asset.originalFilename || asset.id}`} onClick={()=>onSelect(asset)}>
   {selected(asset)?"Selected: ":"Select: "}{asset.originalFilename || "Monument photo"}
  </button>
  {status?.(asset)?<span className="muted">{status(asset)}</span>:null}
 </div>)}</div>;
}

export function PhotoContextFields({faces,faceId,onFaceChange,maintenance,phase,onPhaseChange}: {
 faces: {id:string;label:string}[]; faceId:string; onFaceChange:(value:string)=>void;
 maintenance?:boolean; phase:PhotoContext["phase"]; onPhaseChange:(value:PhotoContext["phase"])=>void;
}) {
 return <>
  <label>Photo face<select value={faceId} onChange={event=>onFaceChange(event.target.value)}>
   <option value="">Face not specified</option>{faces.map(face=><option key={face.id} value={face.id}>{face.label}</option>)}
   {faceId&&!faces.some(face=>face.id===faceId)?<option value={faceId}>Face unavailable (saved link)</option>:null}
  </select></label>
  {maintenance?<label>Maintenance timing<select value={phase} onChange={event=>onPhaseChange(event.target.value as PhotoContext["phase"])}>
   {Object.entries(timingLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
  </select></label>:null}
 </>;
}
