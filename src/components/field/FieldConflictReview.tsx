import { useState } from "react";
import { fieldChanges, applyFieldChanges } from "../../lib/fieldConflictChanges";
import { burialEditPayload, markerEditPayload } from "../../lib/recordEditPayloads";
import type { FieldOperation, FieldSnapshot } from "../../lib/offlineFieldTypes";
import { Notice } from "../ui/Feedback";

export function FieldConflictReview({operation,snapshot,busy,resolve,cancel}:{operation:FieldOperation;snapshot:FieldSnapshot;busy:boolean;resolve:(payload:FieldOperation["payload"],base:FieldOperation["base"])=>Promise<void>;cancel:()=>void}){
  const person=snapshot.burials.find(p=>p.id===operation.targetId);
  const latest=operation.kind==="marker"?markerEditPayload(snapshot.headstone):operation.kind==="burial"&&person?burialEditPayload(person):undefined;
  const changes=latest&&operation.base?fieldChanges(operation.base,operation.payload,latest):[];
  const [mine,setMine]=useState(new Set<number>()),[error,setError]=useState("");
  function label(path:string[]){
    const key=path.at(-1)??"Field";
    const name=key.replace(/([a-z])([A-Z])/gu,"$1 $2").replace(/Id$/u,"");
    return path[0]==="faces"?`${snapshot.headstone.faces?.find(f=>f.id===path[1])?.label??"Recorded face"} ${name}`:name;
  }
  const display=(value:unknown)=>typeof value==="string"?([...(snapshot.lookups.conditions??[]),...(snapshot.lookups.markerTypes??[]),...(snapshot.lookups.materials??[])].find(o=>o.id===value)?.label??value):String(value??"(blank)");
  return <section className="admin-section">
    <h2>Review queued changes</h2>
    {!latest||!operation.base?<Notice>This change needs review in the main application. The saved proposal remains on this device.</Notice>:<>
      <p>Unrelated changes from the server are retained. Choose which value to use wherever the same field changed.</p>
      {changes.map((change,index)=><article key={change.path.join(":")} className="field-change">
        <h3>{label(change.path)}</h3><p>Latest: <span>{display(change.current)}</span></p><p>Your proposal: <span>{display(change.proposed)}</span></p>
        {change.missing?<p>This field is no longer available. Keep the latest record and review the original in the main application.</p>:change.conflict?<label><input type="checkbox" checked={mine.has(index)} onChange={e=>setMine(current=>{const next=new Set(current);if(e.target.checked)next.add(index);else next.delete(index);return next;})}/>Use my proposed value for {label(change.path)}</label>:<p>Your change can be applied without replacing a different edit.</p>}
      </article>)}
      <div className="admin-form-actions"><button type="button" disabled={busy} onClick={async()=>{setError("");try{await resolve(applyFieldChanges(latest,changes,mine),latest);}catch(e){setError(e instanceof Error?e.message:"Unable to queue the reviewed changes.");}}}>Queue reviewed changes on this device</button></div>
    </>}
    <div className="admin-form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={cancel}>Back to saved work</button></div>
    {error&&<Notice tone="error">{error}</Notice>}
  </section>;
}
