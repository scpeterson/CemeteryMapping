import "./policies.css";
import { GravesiteExceptionsPanel } from "./GravesiteExceptions";
import {useEffect,useState} from "react";
import {fetchPolicies,postPolicy,type PolicySnapshot,type PolicyRow,type PolicyPreview} from "../../api/policyApi";
import {matchingPolicies,localPolicy} from "../../../shared/locationPolicyResolution.mjs";
const valueLabel=(p?:PolicyRow|null)=>p?(p.enabled?'Enabled':'Disabled'):'Inherit';
export function PoliciesAdminTab({systemAdmin,hasAccount}:{systemAdmin:boolean;hasAccount:boolean}){
 const [data,setData]=useState<PolicySnapshot>();const [cemeteryId,setCemetery]=useState('');const [sectionId,setSection]=useState('');const [blockId,setBlock]=useState('');
 const [rule,setRule]=useState('no_gravesites');const [value,setValue]=useState('inherit');const [reason,setReason]=useState('');
 const [loading,setLoading]=useState(true);
 const [preview,setPreview]=useState<PolicyPreview>();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const scope={cemeteryId:cemeteryId||null,sectionId:sectionId||null,blockId:blockId||null};
 useEffect(()=>{let live=true;setLoading(true);setError('');fetchPolicies().then(d=>{if(live){setData(d);if(!systemAdmin)setCemetery(d.cemeteries[0]?.id??'');}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[systemAdmin]);
 useEffect(()=>{setPreview(undefined);setMessage('');},[cemeteryId,sectionId,blockId,rule,value,reason]);
 const chooseScope=(cemetery:string,section='',block='')=>{setCemetery(cemetery);setSection(section);setBlock(block);const local=data&&localPolicy(data.policies,{cemeteryId:cemetery||null,sectionId:section||null,blockId:block||null},rule);setValue(local?(local.enabled?'enabled':'disabled'):'inherit');setReason('');};
 const historyPage=async(cursor?:string)=>{setBusy(true);setLoading(true);setError('');setPreview(undefined);try{const next=await fetchPolicies(cursor);setData(next);if(!systemAdmin&&!cemeteryId)setCemetery(next.cemeteries[0]?.id??'');}catch(e){setError(e instanceof Error?e.message:'Policy request failed.');}finally{setBusy(false);setLoading(false);}};
 const source=(p?:PolicyRow)=>!p?'Base behavior':p.block_uuid?`Block ${data?.blocks.find(b=>b.id===p.block_uuid)?.name??p.block_uuid}`:p.section_uuid?`Section ${data?.sections.find(s=>s.id===p.section_uuid)?.name??p.section_uuid}`:p.cemetery_id?data?.cemeteries.find(c=>c.id===p.cemetery_id)?.name??'Cemetery':'System';
 const submit=async(action:'preview'|'save')=>{
  if(!data)return;setBusy(true);setError('');setMessage('');
  try{const result=await postPolicy(action,{...scope,rule,value:value==='inherit'?null:value==='enabled',reason,revision:data.revision},preview?.previewToken);
   if(action==='preview')setPreview(result);else{setPreview(undefined);setData(await fetchPolicies());setMessage('Policy saved. Reopen affected records to see the current policy.');}
  }catch(e){setPreview(undefined);setError(e instanceof Error?e.message:'Policy request failed.');}finally{setBusy(false);}
 };
 return <section className="policies-admin"><h2>Policies</h2>
  <p>Rules inherit from system to cemetery, section and block. Enabled applies the restriction. Disabled explicitly overrides it. Inherit removes the local override.</p>
  <p>Marker and burial rules apply through gravesite associations; unlinked monuments are outside this catalog.</p>
  <p>Changes take effect when saved. Stacking authorization dates remain in Admin → Records; earlier reservations remain protected.</p>
  {error?<p role="alert" className="admin-error">{error} <button type="button" disabled={busy} onClick={()=>void historyPage()}>Reload policies</button></p>:null}
  {!hasAccount?<p>A signed-in application account is required to preview or save policies.</p>:null}
  {message?<p role="status">{message}</p>:null}
  {!data?(loading?<p role="status">Loading policies…</p>:null):<>
   <fieldset disabled={busy}><legend>Location</legend><div className="policies-fields">
    <label>Cemetery<select value={cemeteryId} onChange={e=>chooseScope(e.target.value)}>{systemAdmin?<option value="">System defaults</option>:<option value="" disabled>Select cemetery</option>}{data.cemeteries.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Section<select value={sectionId} disabled={!cemeteryId} onChange={e=>chooseScope(cemeteryId,e.target.value)}><option value="">Cemetery defaults</option>{data.sections.filter(s=>s.cemeteryId===cemeteryId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label>Block<select value={blockId} disabled={!sectionId} onChange={e=>chooseScope(cemeteryId,sectionId,e.target.value)}><option value="">Section defaults</option>{data.blocks.filter(b=>b.sectionId===sectionId).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   </div></fieldset>
   {hasAccount && data.cemeteries.some(c => c.id === cemeteryId && c.facilityId === "1")
     && <GravesiteExceptionsPanel key={cemeteryId} cemeteryId={cemeteryId} />}
   <div className="policies-rules">{data.catalog.map(r=>{const effective=matchingPolicies(data.policies,scope,r.key)[0],local=localPolicy(data.policies,scope,r.key);return <article key={r.key}><h3>{r.label}</h3><p>Local: {valueLabel(local)} · Effective: {effective?.enabled?'Enabled':'Disabled'} · Source: {source(effective)}</p><p>{effective?.reason??'No inherited restriction is configured.'}</p><button className="ui-button ui-button--secondary" type="button" disabled={busy||!hasAccount||(!systemAdmin&&!cemeteryId)} onClick={()=>{setRule(r.key);setValue(local?(local.enabled?'enabled':'disabled'):'inherit');setReason('');}}>Edit {r.label}</button></article>;})}</div>
   <fieldset disabled={busy||!hasAccount||(!systemAdmin&&!cemeteryId)}><legend>Change a policy</legend><div className="policies-fields">
    <label>Rule<select value={rule} onChange={e=>{setRule(e.target.value);const p=localPolicy(data.policies,scope,e.target.value);setValue(p?(p.enabled?'enabled':'disabled'):'inherit');}}>{data.catalog.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</select></label>
    <label>Local value<select value={value} onChange={e=>setValue(e.target.value)}><option value="inherit">Inherit</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
    <label>Reason<textarea required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   </div><div className="policies-actions"><button className="ui-button ui-button--secondary" type="button" disabled={!reason.trim()} onClick={()=>void submit('preview')}>Preview change</button><button className="ui-button ui-button--primary" type="button" disabled={!preview} onClick={()=>void submit('save')}>Save policy</button></div>
   {preview?<p role="status">No conflicts found. Effective rule changes for {preview.impact.graves} graves, {preview.impact.markers} associated markers and {preview.impact.burials} burials. No records have been saved. Preview expires in five minutes; saving validates current records again.</p>:null}
   </fieldset>
   <h3>Recent policy changes</h3><p>Up to 100 changes per page, limited to your permitted cemeteries.</p><ol>{data.history.map(h=><li key={h.id}><strong>{data.catalog.find(r=>r.key===h.rule_key)?.label}</strong> · {h.scope_label} · {valueLabel(h.before_value)} → {valueLabel(h.after_value)}<p>{h.reason} — {h.actor_email}, {new Date(h.created_at).toLocaleString()}</p></li>)}</ol>{!data.history.length?<p>No recorded policy changes.</p>:null}<div className="policies-actions"><button type="button" disabled={busy} onClick={()=>void historyPage()}>Newest changes</button>{data.historyCursor?<button type="button" disabled={busy} onClick={()=>void historyPage(data.historyCursor!)}>Older changes</button>:null}</div>
  </>}
 </section>;
}
