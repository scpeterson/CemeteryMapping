import { useState, type FormEvent } from "react";
import { confirmDiscardChanges, useDraftState } from "../../hooks/useDraftState";
import { burialEditPayload, markerEditPayload } from "../../lib/recordEditPayloads";
import type { FieldOperation, FieldSnapshot } from "../../lib/offlineFieldTypes";
import type { Burial, LookupOption, SaveBurialInput, SaveHeadstoneInput } from "../../types";
import { Notice } from "../ui/Feedback";

export type QueueFieldAction=(kind:FieldOperation["kind"],targetId:string,payload:FieldOperation["payload"],base?:FieldOperation["base"])=>Promise<void>;
type Props={snapshot:FieldSnapshot;operations:FieldOperation[];busy:boolean;canInspect:boolean;queue:QueueFieldAction};
const active=(operation:FieldOperation)=>!["synced","discarded"].includes(operation.state);
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
function options(values:LookupOption[],current?:LookupOption){return current&&!values.some(v=>v.id===current.id)?[current,...values]:values;}

function PersonEditor({person,busy,operation,queue}:{person:Burial;busy:boolean;operation?:FieldOperation;queue:QueueFieldAction}){
  const base=operation?.base as SaveBurialInput|undefined??burialEditPayload(person);
  const [form,setForm]=useDraftState<SaveBurialInput>(()=>operation?.payload as SaveBurialInput|undefined??base);
  const [error,setError]=useState("");const [saved,setSaved]=useState(false);
  if(operation&&(operation.attempted||operation.state==="conflict"))return <Notice>This person's queued change needs synchronization or review before another edit.</Notice>;
  return <form className="admin-form" onSubmit={async event=>{event.preventDefault();setError("");try{await queue("burial",person.id,form,base);setForm(form);setSaved(true);}catch(e){setError(e instanceof Error?e.message:"Unable to save the device draft.");}}}>
    <h3>Person details: {person.person.firstName} {person.person.lastName}</h3>
    <label>First name<input disabled={busy} maxLength={100} value={form.firstName} onChange={e=>{const value=e.target.value;setForm(f=>({...f,firstName:value,givenNameStatus:value?"recorded":"unknown"}));setSaved(false);}}/></label>
    <label>Given name status<select disabled={busy} value={form.givenNameStatus} onChange={e=>setForm(f=>({...f,givenNameStatus:e.target.value as SaveBurialInput["givenNameStatus"]}))}><option value="recorded">Recorded</option><option value="unknown">Unknown / not recorded</option><option value="no_given_name">No given name</option></select></label>
    <label>Last name<input disabled={busy} maxLength={150} value={form.lastName} onChange={e=>setForm(f=>({...f,lastName:e.target.value}))}/></label>
    <label>Maiden name<input disabled={busy} maxLength={150} value={form.maidenName} onChange={e=>setForm(f=>({...f,maidenName:e.target.value}))}/></label>
    <label>Birth date<input disabled={busy} value={form.birthDate} placeholder="YYYY, YYYY-MM, or exact date" onChange={e=>setForm(f=>({...f,birthDate:e.target.value}))}/></label>
    <label>Death date<input disabled={busy} value={form.deathDate} placeholder="YYYY, YYYY-MM, or exact date" onChange={e=>setForm(f=>({...f,deathDate:e.target.value}))}/></label>
    <label>Burial date<input type="date" disabled={busy} value={form.burialDate} onChange={e=>setForm(f=>({...f,burialDate:e.target.value}))}/></label>
    <label>Person notes<textarea disabled={busy} maxLength={4000} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label>
    <div className="admin-form-actions"><button type="submit" disabled={busy}>Save person on this device</button></div>
    {saved&&<Notice>Saved on this device; synchronization is still required.</Notice>}{error&&<Notice tone="error">{error}</Notice>}
  </form>;
}

function ObservationEditor({snapshot,busy,queue}:Props){
  const blank=()=>({id:crypto.randomUUID(),inspectedAt:today(),source:"Field observation",conditionId:"",conditionNotes:"",faces:(snapshot.headstone.faces??[]).map(f=>({id:f.id,label:f.label,inscription:"",designNotes:""}))});
  const [form,setForm]=useDraftState(blank),[error,setError]=useState(""),[saved,setSaved]=useState(false);
  return <form className="admin-form" onSubmit={async event=>{
    event.preventDefault();setError("");
    const payload:SaveHeadstoneInput={...markerEditPayload(snapshot.headstone),inspectionChangesOnly:true,newInspections:[{...form,inscription:"",sourceType:"field_survey"}],reason:"Field observation collected offline"};
    try{await queue("inspection",snapshot.headstone.id,payload);setForm(blank());setSaved(true);}catch(e){setError(e instanceof Error?e.message:"Unable to save the observation.");}
  }}>
    <h3>New observation</h3><p className="field-wide">Record what you observe during this visit. Previous readings remain separate.</p>
    <label>Observation date<input type="date" required disabled={busy} value={form.inspectedAt} onChange={e=>setForm(f=>({...f,inspectedAt:e.target.value}))}/></label>
    <label>Observation source<input required maxLength={500} disabled={busy} value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))}/></label>
    <label>Observed condition<select required disabled={busy} value={form.conditionId} onChange={e=>setForm(f=>({...f,conditionId:e.target.value}))}><option value="">Choose observed condition</option>{(snapshot.lookups.conditions??[]).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
    <label>Condition notes<textarea maxLength={4000} disabled={busy} value={form.conditionNotes} onChange={e=>setForm(f=>({...f,conditionNotes:e.target.value}))}/></label>
    {form.faces.map((face,index)=><label className="field-wide" key={face.id}>{face.label} inscription<textarea rows={4} maxLength={20000} disabled={busy} value={face.inscription} onChange={e=>setForm(f=>({...f,faces:f.faces.map((item,i)=>i===index?{...item,inscription:e.target.value}:item)}))}/></label>)}
    <div className="admin-form-actions"><button type="submit" disabled={busy}>Save observation on this device</button></div>
    {saved&&<Notice>Observation saved on this device. You can now select it when adding a photo.</Notice>}{error&&<Notice tone="error">{error}</Notice>}
  </form>;
}

export function FieldRecordEditors(props:Props){
  const {snapshot,operations,busy,queue,canInspect}=props;
  const pending=operations.find(o=>o.kind==="marker"&&o.targetId===snapshot.headstone.id&&active(o));
  const base=pending?.base as SaveHeadstoneInput|undefined??markerEditPayload(snapshot.headstone);
  const [form,setForm]=useDraftState<SaveHeadstoneInput>(()=>pending?.payload as SaveHeadstoneInput|undefined??base);
  const [error,setError]=useState("");const [personId,setPersonId]=useState(snapshot.burials[0]?.id??"");
  const [graveId,setGraveId]=useDraftState("");const [relationship,setRelationship]=useDraftState("secondary");
  const [linkNotes,setLinkNotes]=useDraftState("");
  const person=snapshot.burials.find(p=>p.id===personId);
  async function saveMarker(event:FormEvent){event.preventDefault();setError("");try{await queue("marker",snapshot.headstone.id,form,base);setForm(form);}catch(e){setError(e instanceof Error?e.message:"Unable to save marker details.");}}
  return <>
    <section className="admin-section">
      {pending&&(pending.attempted||pending.state==="conflict")?<Notice>Marker details have a queued change awaiting synchronization or review.</Notice>:<form className="admin-form" onSubmit={event=>void saveMarker(event)}>
        <h3>Marker details</h3>
        <label>Marker type<select disabled={busy} value={form.markerTypeId} onChange={e=>setForm(f=>({...f,markerTypeId:e.target.value}))}>{options(snapshot.lookups.markerTypes??[],snapshot.headstone.markerType).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
        <label>Material<select disabled={busy} value={form.materialId} onChange={e=>setForm(f=>({...f,materialId:e.target.value}))}>{options(snapshot.lookups.materials??[],snapshot.headstone.material).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
        <label className="field-wide">Marker notes<textarea maxLength={4000} disabled={busy} value={form.designNotes} onChange={e=>setForm(f=>({...f,designNotes:e.target.value}))}/></label>
        <div className="admin-form-actions"><button type="submit" disabled={busy}>Save marker on this device</button></div>
      </form>}
    </section>
    <section className="admin-section">
      <h3>People on this marker</h3>
      {snapshot.burials.length?<>
        <label>Person<select disabled={busy} value={personId} onChange={e=>{if(confirmDiscardChanges())setPersonId(e.target.value);}}>{snapshot.burials.map(p=><option key={p.id} value={p.id}>{p.person.firstName} {p.person.lastName}</option>)}</select></label>
        {person&&<PersonEditor key={person.id} person={person} busy={busy} operation={operations.find(o=>o.kind==="burial"&&o.targetId===person.id&&active(o))} queue={queue}/>}
      </>:<p>No linked people were downloaded for this marker.</p>}
    </section>
    {canInspect&&<section className="admin-section"><ObservationEditor {...props}/></section>}
    <section className="admin-section">
      <form className="admin-form" onSubmit={async event=>{event.preventDefault();setError("");try{await queue("link",snapshot.headstone.id,{gravesiteId:graveId,relationshipType:relationship as "secondary",notes:linkNotes,reason:"Existing gravesite link collected in the field"});setLinkNotes("");setGraveId("");}catch(e){setError(e instanceof Error?e.message:"Unable to queue this link.");}}}>
        <h3>Link an existing gravesite</h3>
        <label>Downloaded nearby gravesite<select required disabled={busy} value={graveId} onChange={e=>setGraveId(()=>e.target.value)}><option value="">Choose gravesite</option>{snapshot.nearbyGraves.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
        <label>Relationship<select disabled={busy} value={relationship} onChange={e=>setRelationship(()=>e.target.value)}><option value="secondary">Secondary</option><option value="spans">Spans gravesites</option><option value="nearby">Nearby</option><option value="inferred">Inferred</option><option value="footstone">Footstone</option></select></label>
        <label className="field-wide">Link notes<textarea disabled={busy} maxLength={4000} value={linkNotes} onChange={e=>setLinkNotes(()=>e.target.value)}/></label>
        <div className="admin-form-actions"><button type="submit" disabled={busy}>Save link on this device</button></div>
      </form>
    </section>
    {error&&<Notice tone="error">{error}</Notice>}
  </>;
}
