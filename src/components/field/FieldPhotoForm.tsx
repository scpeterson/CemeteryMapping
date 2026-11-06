import { useState, useRef } from "react";
import { useDraftState } from "../../hooks/useDraftState";
import type { FieldPhoto, FieldSnapshot, FieldOperation } from "../../lib/offlineFieldTypes";
import { Notice } from "../ui/Feedback";

function mime(file:File){const type=file.type.toLowerCase();if(type)return type==="image/jpg"?"image/jpeg":type;return ({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",heic:"image/heic",heif:"image/heif"} as Record<string,string>)[file.name.split(".").at(-1)?.toLowerCase()??""]??"";}

export function FieldPhotoForm({snapshot,operations,busy,save}:{snapshot:FieldSnapshot;operations:FieldOperation[];busy:boolean;save:(photo:FieldPhoto,file:File)=>Promise<void>}){
  const blank={filename:"",notes:"",capturedAt:"",inspectionId:"",faceId:""};
  const [form,setForm]=useDraftState(blank);const [file,setFile]=useState<File>();const fileInput=useRef<HTMLInputElement>(null);
  const [error,setError]=useState("");const [saved,setSaved]=useState(false);
  const [position,setPosition]=useState<{latitude:number;longitude:number;gpsAccuracy:number}>();
  const [locating,setLocating]=useState(false);
  const observations=[...(snapshot.headstone.inspections??[]),...operations.filter(o=>o.kind==="inspection"&&o.targetId===snapshot.headstone.id&&!["synced","discarded"].includes(o.state)).flatMap(o=>"newInspections" in o.payload?o.payload.newInspections??[]:[])];
  const faces=observations.find(o=>o.id===form.inspectionId)?.faces??[];
  return <form className="admin-form" onSubmit={async event=>{
    event.preventDefault();setError("");if(!file)return;
    const contentType=mime(file);
    if(!["image/jpeg","image/png","image/webp","image/heic","image/heif"].includes(contentType)){setError("Choose a JPEG, PNG, WebP, HEIC or HEIF photo.");return;}
    if(file.size>25*1024*1024){setError("Choose a photo smaller than 25 MB.");return;}
    try{
      await save({id:crypto.randomUUID(),markerId:snapshot.headstone.id,cemeteryId:snapshot.cemeteryId,filename:file.name,contentType,size:file.size,notes:form.notes,
        capturedAt:form.capturedAt?new Date(form.capturedAt).toISOString():"",inspectionId:form.inspectionId||undefined,faceId:form.faceId||undefined,...position,state:"pending",attempted:false},file);
      setFile(undefined);setForm(blank);setPosition(undefined);setSaved(true);if(fileInput.current)fileInput.current.value="";
    }catch(e){setError(e instanceof Error?e.message:"Unable to save this photo on the device.");}
  }}>
    <h3>Capture a photo</h3>
    <label className="field-wide">Photo<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" capture="environment" required disabled={busy} onChange={e=>{const selected=e.target.files?.[0];setFile(selected);setForm(f=>({...f,filename:selected?.name??""}));setSaved(false);}}/></label>
    <label>Observation<select disabled={busy} value={form.inspectionId} onChange={e=>setForm(f=>({...f,inspectionId:e.target.value,faceId:""}))}><option value="">Marker photo</option>{observations.map(o=><option key={o.id} value={o.id}>{o.source} · {o.inspectedAt||("inspectionYear" in o?o.inspectionYear:"")}</option>)}</select></label>
    <label>Photo face<select disabled={busy||!form.inspectionId} value={form.faceId} onChange={e=>setForm(f=>({...f,faceId:e.target.value}))}><option value="">Unspecified</option>{faces.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
    <label>Date taken (optional)<input type="datetime-local" disabled={busy} value={form.capturedAt} onChange={e=>setForm(f=>({...f,capturedAt:e.target.value}))}/></label>
    <label>Photo notes<textarea maxLength={4000} disabled={busy} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label>
    <div className="admin-form-actions">
      <button type="button" className="secondary-button" disabled={busy||locating} onClick={()=>{
        if(!navigator.geolocation){setError("Device location is unavailable.");return;}
        setLocating(true);navigator.geolocation.getCurrentPosition(p=>{setPosition({latitude:p.coords.latitude,longitude:p.coords.longitude,gpsAccuracy:p.coords.accuracy});setLocating(false);},()=>{setError("Location was not available. You can save the photo without it.");setLocating(false);},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
      }}>{locating?"Finding location…":position?"Photo location recorded":"Use device location for photo"}</button>
      <button type="submit" disabled={busy||!file}>Save photo on this device</button>
    </div>
    {saved&&<Notice>Photo file and notes are saved on this device. Synchronize when connected.</Notice>}{error&&<Notice tone="error">{error}</Notice>}
  </form>;
}
