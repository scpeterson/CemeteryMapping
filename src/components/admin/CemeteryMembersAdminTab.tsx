import { useEffect, useState, type FormEvent } from "react";
import { fetchCemeteryMembers, saveCemeteryMember, type CemeteryMember } from "../../api/cemeteryMembersApi";
import type { CemeteryAdminRecords, CurrentUser } from "../../types";
import { confirmDiscardChanges, useDraftState } from "../../hooks/useDraftState";
import { Notice } from "../ui/Feedback";

const roleNames = { reader:"Read-only", "power-user":"Power user", "cemetery-admin":"Cemetery admin" };
const blank = { id:"",email:"",displayName:"",role:"reader" as CemeteryMember["role"],version:"",reason:"" };

export function CemeteryMembersAdminTab({ currentUser, cemeteryRecords }: { currentUser: CurrentUser; cemeteryRecords: CemeteryAdminRecords }) {
  const memberships=currentUser.cemeteryMemberships??currentUser.assignedCemeteryIds.map(cemeteryId=>({cemeteryId,role:currentUser.role}));
  const cemeteries=cemeteryRecords.cemeteries.filter(c=>currentUser.role==="admin"||memberships.some(m=>m.cemeteryId===c.id&&m.role==="cemetery-admin"));
  const [cemeteryId,setCemeteryId]=useState(cemeteries[0]?.id??"");
  const [query,setQuery]=useState("");const [search,setSearch]=useState("");const [offset,setOffset]=useState(0);
  const [rows,setRows]=useState<CemeteryMember[]>([]);const [hasMore,setHasMore]=useState(false);
  const [form,setForm]=useDraftState(blank);const [refresh,setRefresh]=useState(0);
  const [loading,setLoading]=useState(false);const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");const [message,setMessage]=useState("");
  const selectedCemeteryId=cemeteryId||cemeteries[0]?.id||"";
  useEffect(()=>{const timer=setTimeout(()=>setSearch(query),200);return()=>clearTimeout(timer);},[query]);
  useEffect(()=>{
    if(!selectedCemeteryId)return;let current=true;setLoading(true);setError("");
    fetchCemeteryMembers(selectedCemeteryId,search,offset).then(items=>{if(current){setRows(items.slice(0,50));setHasMore(items.length>50);}})
      .catch(e=>{if(current)setError(e instanceof Error?e.message:"Unable to load members.");}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[selectedCemeteryId,search,offset,refresh]);
  async function save(event: FormEvent, remove=false){
    event.preventDefault();if(busy)return;
    if(remove&&!window.confirm(`Remove ${form.email} from this cemetery? Their account and other memberships remain available.`))return;
    setBusy(true);setError("");setMessage("");
    try{
      const input=form.id?{role:form.role,reason:form.reason,expectedVersion:form.version}:{role:form.role,reason:form.reason,email:form.email,displayName:form.displayName};
      const result=await saveCemeteryMember(selectedCemeteryId,input,form.id||undefined,remove);
      setForm(blank);setRefresh(n=>n+1);setMessage(remove?"Membership removed.":result.invitationSent?"Membership saved. Invitation email sent.":"Membership saved.");
    }catch(e){setError(e instanceof Error?e.message:"Unable to save membership.");}finally{setBusy(false);}
  }
  return <section className="admin-section cemetery-members">
    <h3>Cemetery members</h3>
    <p>Manage access for this cemetery. System administrators manage account identity and activation.</p>
    {error&&<Notice tone="error">{error}</Notice>}{message&&<Notice tone="success">{message}</Notice>}
    <div className="admin-form"><label>Cemetery<select value={selectedCemeteryId} disabled={busy} onChange={e=>{if(confirmDiscardChanges()){setCemeteryId(e.target.value);setOffset(0);setRows([]);setForm(blank);setMessage("");}}}>
      {cemeteries.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label></div>
    {!selectedCemeteryId?<Notice>No administered cemeteries are available.</Notice>:<>
      <form className="admin-form" onSubmit={event=>void save(event)}>
        <h4>{form.id?"Edit membership":"Invite or add member"}</h4>
        <label>Email<input type="email" required maxLength={320} readOnly={Boolean(form.id)} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></label>
        {!form.id&&<label>Display name<input maxLength={250} value={form.displayName} onChange={e=>setForm(f=>({...f,displayName:e.target.value}))}/></label>}
        <label>Cemetery role<select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value as CemeteryMember["role"]}))}>{Object.entries(roleNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
        <label>Reason<textarea required maxLength={500} value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}/></label>
        <div className="admin-form-actions">
          <button type="submit" disabled={busy}>{busy?"Saving…":form.id?"Save membership":"Invite or add member"}</button>
          {form.id&&<button type="button" className="secondary-button danger-button" disabled={busy||!form.reason.trim()} onClick={event=>void save(event,true)}>Remove membership</button>}
          <button type="button" className="secondary-button" disabled={busy} onClick={()=>{if(confirmDiscardChanges())setForm(blank);}}>New member</button>
        </div>
      </form>
      <div className="admin-form"><label>Search members<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setOffset(0);}}/></label></div>
      {loading?<Notice>Loading members…</Notice>:<div className="admin-table" aria-label="Cemetery members">{rows.map(member=><article key={member.id} className="admin-user-row">
        <button type="button" className="admin-user-edit" disabled={busy||!member.isActive} onClick={()=>{if(confirmDiscardChanges())setForm({...blank,...member});}}>
          <span><strong>{member.displayName||member.email}</strong><small>{member.email}</small></span><span>{roleNames[member.role]}</span><span>{!member.isActive?"Account inactive":"Active"}</span>
        </button>
      </article>)}</div>}
      {!loading&&!rows.length&&<p>No matching members.</p>}
      <div className="admin-form-actions" aria-label="Member pages">
        <button type="button" className="secondary-button" disabled={loading||offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous members</button>
        <span>Page {Math.floor(offset/50)+1}</span>
        <button type="button" className="secondary-button" disabled={loading||!hasMore} onClick={()=>setOffset(offset+50)}>Next members</button>
        <button type="button" className="secondary-button" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>Reload members</button>
      </div>
    </>}
  </section>;
}
