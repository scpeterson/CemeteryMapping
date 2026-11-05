import { fetchCurrentUser } from "../../api/cemeteryApi";
import { useEffect, useRef, useState } from "react";
import type { CurrentUser } from "../../types";
import { fetchFieldCemeteries, fetchFieldSnapshot, type FieldCemetery } from "../../api/fieldCollectionApi";
import { createOfflineVault, deleteOfflineVault, listOfflineVaults, readOfflinePhoto, saveOfflineVault, unlockOfflineVault, type VaultHandle, type VaultSummary } from "../../lib/offlineVault";
import type { FieldOperation, FieldSnapshot, OfflineWorkspace } from "../../lib/offlineFieldTypes";
import { synchronizeFieldWork } from "../../lib/synchronizeFieldWork";
import { prepareOfflineShell } from "../../lib/offlineShell";
import { roleForCemetery } from "../../lib/selectionPermissions";
import { confirmDiscardChanges, useDraftNavigationGuard } from "../../hooks/useDraftState";
import { useRecordOptions } from "../../hooks/useRecordOptions";
import { RecordOptionSearch } from "../detail/RecordOptionSearch";
import { Notice } from "../ui/Feedback";
import { FieldConnection } from "./FieldConnection";
import { FieldRecordEditors, type QueueFieldAction } from "./FieldRecordEditors";
import { FieldPhotoForm } from "./FieldPhotoForm";
import { FieldConflictReview } from "./FieldConflictReview";

const unfinished=(item:{state:string})=>!["synced","discarded"].includes(item.state);
const stateLabel={pending:"Saved on device",sending:"Awaiting confirmation",failed:"Needs retry",conflict:"Review required",synced:"Synchronized",discarded:"Stopped or replaced"};

function DownloadMarker({cemeteryId,busy,download}:{cemeteryId:string;busy:boolean;download:(id:string)=>Promise<void>}){
  const records=useRecordOptions("field-markers",[],true,undefined,undefined,cemeteryId);
  const [id,setId]=useState("");const [error,setError]=useState("");
  return <form className="admin-form" onSubmit={async event=>{event.preventDefault();setError("");try{await download(id);}catch(e){setError(e instanceof Error?e.message:"Unable to download this marker.");}}}>
    <h3>Download a marker for field work</h3>
    <RecordOptionSearch records={records} label="Find marker by ID, gravesite or person"/>
    <label className="field-wide">Marker to download<select required disabled={busy||records.loading} value={id} onChange={e=>{setId(e.target.value);records.remember(e.target.value);}}><option value="">Choose marker</option>{records.options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
    <div className="admin-form-actions"><button type="submit" disabled={busy||!id}>Download record to this device</button></div>
    {error&&<Notice tone="error">{error}</Notice>}
  </form>;
}

export function FieldCollectionPage(){
  useDraftNavigationGuard();
  const [online,setOnline]=useState(navigator.onLine),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const busyRef=useRef(false),handle=useRef<VaultHandle|undefined>(undefined),current=useRef<OfflineWorkspace|undefined>(undefined);
  const [workspace,setWorkspace]=useState<OfflineWorkspace>(),[vaults,setVaults]=useState<VaultSummary[]>([]),[vaultId,setVaultId]=useState("");
  const [passphrase,setPassphrase]=useState(""),[unlockPhrase,setUnlockPhrase]=useState("");
  const [showConnection,setShowConnection]=useState(false),[user,setUser]=useState<CurrentUser>();
  const [cemeteryQuery,setCemeteryQuery]=useState(""),[cemeteries,setCemeteries]=useState<FieldCemetery[]>([]),[chosen,setChosen]=useState<FieldCemetery>();
  const [selectedId,setSelectedId]=useState(""),[review,setReview]=useState<{operation:FieldOperation;snapshot:FieldSnapshot}>();
  const [shellReady,setShellReady]=useState(false);
  useEffect(()=>{const change=()=>setOnline(navigator.onLine);window.addEventListener("online",change);window.addEventListener("offline",change);return()=>{window.removeEventListener("online",change);window.removeEventListener("offline",change);};},[]);
  useEffect(()=>{void listOfflineVaults().then(setVaults).catch(()=>setError("Offline storage is unavailable in this browser. Use the main application while connected."));},[]);
  useEffect(()=>{
    if(!user||!online||workspace)return;let active=true;
    const timer=setTimeout(()=>void fetchFieldCemeteries(cemeteryQuery).then(rows=>{if(active){setCemeteries(rows);setChosen(value=>value??rows[0]);}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load cemeteries.");}),200);
    return()=>{active=false;clearTimeout(timer);};
  },[user,online,workspace,cemeteryQuery]);
  async function execute(action:()=>Promise<void>){
    if(busyRef.current)throw new Error("Another device operation is still finishing.");
    busyRef.current=true;setBusy(true);setError("");setMessage("");
    try{await action();}catch(e){setError(e instanceof Error?e.message:"Unable to complete this action.");throw e;}finally{busyRef.current=false;setBusy(false);}
  }
  async function persist(next:OfflineWorkspace,photo?:{id:string;file:File}){
    if(!handle.current)throw new Error("Unlock this workspace first.");
    const saved={...next,savedAt:new Date().toISOString()};
    handle.current=await saveOfflineVault(handle.current,saved,photo);
    current.current=saved;setWorkspace(saved);return saved;
  }
  function lock(){
    if(!confirmDiscardChanges())return;
    handle.current=undefined;current.current=undefined;setWorkspace(undefined);setSelectedId("");setReview(undefined);setUnlockPhrase("");
    void listOfflineVaults().then(setVaults).catch(()=>setError("Unable to list saved workspaces."));
  }
  async function mustOwnConnection(document:OfflineWorkspace){
    if(!user||user.subject!==document.ownerSubject)throw new Error("Connect with the account that prepared this workspace.");
    const verified=await fetchCurrentUser();
    if(verified.subject!==document.ownerSubject){setUser(undefined);throw new Error("The connected account changed. Reconnect with the original account before downloading or synchronizing.");}
  }
  async function download(markerId:string){
    if(!confirmDiscardChanges())return;
    await execute(async()=>{
      const document=current.current;if(!document)throw new Error("Unlock a workspace first.");await mustOwnConnection(document);
      const snapshot=await fetchFieldSnapshot(document.cemeteryId,markerId);
      const operations=document.operations.map(o=>{
        if(!unfinished(o)||!o.base||!["marker","burial"].includes(o.kind))return o;
        const version=o.kind==="marker"&&o.targetId===markerId?snapshot.headstone.version:snapshot.burials.find(b=>b.id===o.targetId)?.version;
        return version&&"expectedVersion" in o.payload&&o.payload.expectedVersion!==version?{...o,state:"conflict" as const,error:"This record changed since download. Review the proposed fields before synchronizing."}:o;
      });
      await persist({...document,records:[...document.records.filter(r=>r.headstone.id!==markerId),snapshot],operations});setSelectedId(markerId);setMessage("Record downloaded and saved on this device.");
    });
  }
  const queue:QueueFieldAction=async(kind,targetId,payload,base)=>execute(async()=>{
    const document=current.current;if(!document)throw new Error("Unlock a workspace first.");
    const previous=["marker","burial"].includes(kind)?document.operations.find(o=>o.kind===kind&&o.targetId===targetId&&unfinished(o)):undefined;
    if(previous?.attempted||previous?.state==="conflict")throw new Error("Synchronize or review the saved action before editing it again.");
    const operation:FieldOperation={id:previous?.id??crypto.randomUUID(),cemeteryId:document.cemeteryId,targetId,kind,payload,base:previous?.base??base,state:"pending",attempted:false};
    await persist({...document,operations:previous?document.operations.map(o=>o.id===previous.id?operation:o):[...document.operations,operation]});setMessage("Change saved on this device; synchronization is still required.");
  });
  async function stop(operation:FieldOperation){
    if(!window.confirm("Stop retrying this saved change? It remains in device history and does not undo anything already synchronized."))return;
    await execute(async()=>{
      const document=current.current;if(!document)return;
      const inspectionId="newInspections" in operation.payload?operation.payload.newInspections?.[0]?.id:undefined;
      if(inspectionId&&document.photos.some(p=>p.inspectionId===inspectionId&&unfinished(p)))throw new Error("Stop the observation's queued photos first. Their original files will remain available on this device.");
      await persist({...document,operations:document.operations.map(o=>o.id===operation.id?{...o,state:"discarded",error:"Stopped on this device."}:o)});
    });
  }
  const connected=Boolean(user&&workspace&&user.subject===workspace.ownerSubject&&online);
  const role=workspace?(user?roleForCemetery(user,workspace.cemeteryId):workspace.preparedRole??"reader"):"reader";
  const editable=["admin","cemetery-admin","power-user"].includes(role);
  const selected=workspace?.records.find(r=>r.headstone.id===(selectedId||workspace.records[0]?.headstone.id));
  const pending=(workspace?.operations.filter(unfinished).length??0)+(workspace?.photos.filter(unfinished).length??0);
  const choices=chosen&&!cemeteries.some(c=>c.id===chosen.id)?[chosen,...cemeteries]:cemeteries;
  return <main className="field-workspace">
    <header><h1>Field collection</h1><p>Download records before your visit, save work on this device, and synchronize when connected.</p><a href="/">Return to cemetery map</a></header>
    <Notice>{online?"Connection available":"Offline — use your downloaded records"}</Notice>
    {error&&<Notice tone="error">{error}</Notice>}{message&&<Notice tone="success">{message}</Notice>}
    <section className="field-card admin-section">
      <h2>Connection</h2>
      {user&&<p>Connected as {user.displayName||user.email||"approved account"}.</p>}
      {!showConnection?<div className="admin-form-actions"><button type="button" disabled={!online||busy} onClick={()=>{if(confirmDiscardChanges())setShowConnection(true);}}>Connect for downloads and synchronization</button></div>:<FieldConnection disabled={busy||!online} onConnected={async account=>{
        if(!confirmDiscardChanges())return;
        if(current.current&&account.subject!==current.current.ownerSubject){lock();setUser(account);throw new Error("This workspace belongs to another account and was locked. Connect with its original account to synchronize it.");}
        setCemeteries([]);setChosen(undefined);setUser(account);setMessage("Account verified. The server checks cemetery access again for every synchronized change.");
      }}/>}
      {showConnection&&<div className="admin-form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setShowConnection(false);setUser(undefined);}}>Disconnect synchronization</button></div>}
    </section>
    {!workspace?<>
      <section className="field-card admin-section"><h2>Open saved device work</h2>
        <form className="admin-form" onSubmit={event=>{event.preventDefault();void execute(async()=>{
          const opened=await unlockOfflineVault(vaultId,unlockPhrase);
          if(user&&user.subject!==opened.document.ownerSubject)throw new Error("Disconnect synchronization or connect with the original account before opening this workspace.");
          handle.current=opened.handle;current.current=opened.document;setWorkspace(opened.document);setSelectedId(opened.document.records[0]?.headstone.id??"");setUnlockPhrase("");
        }).catch(()=>{});}}>
          <label>Saved workspace<select required disabled={busy} value={vaultId} onChange={e=>setVaultId(e.target.value)}><option value="">Choose saved workspace</option>{vaults.map(v=><option key={v.id} value={v.id}>{new Date(v.savedAt).toLocaleString()}</option>)}</select></label>
          <label>Offline passphrase<input type="password" required minLength={8} disabled={busy} autoComplete="current-password" value={unlockPhrase} onChange={e=>setUnlockPhrase(e.target.value)}/></label>
          <div className="admin-form-actions"><button type="submit" disabled={busy||!vaultId}>Unlock saved work</button></div>
        </form>
        {!vaults.length&&<p>No saved field workspaces on this device.</p>}
      </section>
      {user&&online&&<section className="field-card admin-section"><h2>Prepare a new workspace</h2>
        <form className="admin-form" onSubmit={event=>{event.preventDefault();void execute(async()=>{
          if(!chosen||!user.subject)throw new Error("Choose an administered cemetery with an approved account.");
          const verified=await fetchCurrentUser();
          if(verified.subject!==user.subject)throw new Error("The connected account changed. Reconnect before preparing this workspace.");
          const preparedRole=roleForCemetery(verified,chosen.id);if(!["admin","cemetery-admin","power-user"].includes(preparedRole))throw new Error("Editor access is required for this cemetery.");
          const document:OfflineWorkspace={format:1,id:crypto.randomUUID(),ownerSubject:user.subject,ownerLabel:user.displayName||user.email,preparedRole,cemeteryId:chosen.id,cemeteryName:chosen.name,records:[],operations:[],photos:[],savedAt:new Date().toISOString()};
          handle.current=await createOfflineVault(document,passphrase);current.current=document;setWorkspace(document);setPassphrase("");setSelectedId("");setMessage("Workspace created. Download records and prepare offline page loading before disconnecting.");
        }).catch(()=>{});}}>
          <label>Find cemetery<input maxLength={120} value={cemeteryQuery} onChange={e=>setCemeteryQuery(e.target.value)} disabled={busy}/></label>
          <label>Cemetery<select required disabled={busy} value={chosen?.id??""} onChange={e=>setChosen(choices.find(c=>c.id===e.target.value))}><option value="">Choose cemetery</option>{choices.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field-wide">Create offline passphrase<input type="password" minLength={8} maxLength={200} required autoComplete="new-password" disabled={busy} value={passphrase} onChange={e=>setPassphrase(e.target.value)}/><small>Keep this passphrase: your downloaded records, drafts and photos are encrypted with it. It is required to reopen device work.</small></label>
          <div className="admin-form-actions"><button type="submit" disabled={busy||!chosen}>Create device workspace</button></div>
        </form>
      </section>}
    </>:<>
      <section className="field-card admin-section"><h2>{workspace.cemeteryName}</h2>
        <p>Prepared by {workspace.ownerLabel||"the original account"}. Last saved on this device: {new Date(workspace.savedAt).toLocaleString()}.</p>
        <p role="status">{pending} saved action{pending===1?"":"s"} awaiting synchronization.</p>
        <div className="admin-form-actions">
          <button type="button" disabled={busy||!online} onClick={()=>void execute(async()=>{await prepareOfflineShell();setShellReady(true);setMessage("Offline page loading is ready. Bookmark this field page before your visit.");}).catch(()=>{})}>{shellReady?"Refresh offline page files":"Prepare offline page loading"}</button>
          <button type="button" disabled={busy||!connected} onClick={()=>{if(!confirmDiscardChanges())return;void execute(async()=>{const document=current.current;if(!document)return;await synchronizeFieldWork(document,persist,(id,name,mime)=>{if(!handle.current)throw new Error("Unlock the workspace first.");return readOfflinePhoto(handle.current,id,name,mime);});setMessage("Saved changes and photos are synchronized. Downloaded records were refreshed.");}).catch(()=>{});}}>Synchronize saved work</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={lock}>Lock workspace</button>
        </div>
        <p>Save each form on this device before synchronizing. Downloaded copies remain available with your offline passphrase; synchronization requires the original account.</p>
      </section>
      {connected&&<section className="field-card admin-section"><DownloadMarker key={workspace.id} cemeteryId={workspace.cemeteryId} busy={busy} download={download}/></section>}
      {workspace.records.length>0&&<section className="field-card admin-section">
        <label>Downloaded marker<select disabled={busy} value={selected?.headstone.id??""} onChange={e=>{if(confirmDiscardChanges())setSelectedId(e.target.value);}}>{workspace.records.map(r=><option key={r.headstone.id} value={r.headstone.id}>{r.headstone.headstoneId}</option>)}</select></label>
        {selected&&<p>Downloaded {new Date(selected.downloadedAt).toLocaleString()}.</p>}
        {selected&&connected&&<div className="admin-form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>void download(selected.headstone.id).catch(()=>{})}>Refresh downloaded record</button></div>}
        {review?<FieldConflictReview key={review.operation.id} operation={review.operation} snapshot={review.snapshot} busy={busy} cancel={()=>setReview(undefined)} resolve={async(payload,base)=>execute(async()=>{
          const document=current.current;if(!document)return;
          const replacement:FieldOperation={...review.operation,id:crypto.randomUUID(),payload,base,state:"pending",attempted:false,error:undefined,errorStatus:undefined};
          await persist({...document,records:[...document.records.filter(r=>r.headstone.id!==review.snapshot.headstone.id),review.snapshot],operations:[...document.operations.map(o=>o.id===review.operation.id?{...o,state:"discarded" as const,error:"Replaced after reviewing current server values."}:o),replacement]});setReview(undefined);setMessage("Reviewed changes queued with the latest record version.");
        })}/>:selected&&editable?<>
          <FieldRecordEditors key={`${selected.headstone.id}:${selected.downloadedAt}`} snapshot={selected} operations={workspace.operations} busy={busy} canInspect={["admin","cemetery-admin"].includes(role)} queue={queue}/>
          <section className="admin-section"><FieldPhotoForm key={`photo:${selected.headstone.id}:${selected.downloadedAt}`} snapshot={selected} operations={workspace.operations} busy={busy} save={async(photo,file)=>execute(async()=>{const document=current.current;if(document)await persist({...document,photos:[...document.photos,photo]},{id:photo.id,file});})}/></section>
        </>:selected?<Notice>Current access is read-only. Saved drafts remain available for review.</Notice>:null}
      </section>}
      <section className="field-card admin-section"><h2>Saved work and synchronization</h2>
        {workspace.operations.map(operation=><article className="field-change" key={operation.id}>
          <p><strong>{{marker:"Marker details",burial:"Person details",inspection:"Observation",link:"Gravesite link"}[operation.kind]}</strong> · {stateLabel[operation.state]}</p>
          {operation.error&&<Notice tone={operation.state==="discarded"?"info":"error"}>{operation.error}</Notice>}
          {operation.state==="conflict"&&connected&&["marker","burial"].includes(operation.kind)&&<div className="admin-form-actions"><button type="button" disabled={busy} onClick={()=>{
            if(!confirmDiscardChanges())return;
            void execute(async()=>{const document=current.current;if(!document)return;await mustOwnConnection(document);const original=document.records.find(r=>r.headstone.id===operation.targetId||r.burials.some(b=>b.id===operation.targetId));if(!original)throw new Error("The downloaded source record is unavailable.");const snapshot=await fetchFieldSnapshot(document.cemeteryId,original.headstone.id);setSelectedId(original.headstone.id);setReview({operation,snapshot});}).catch(()=>{});
          }}>Review conflict with latest record</button></div>}
          {unfinished(operation)&&<div className="admin-form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>void stop(operation).catch(()=>{})}>Stop retrying this change</button></div>}
        </article>)}
        {workspace.photos.map(photo=><article className="field-change" key={photo.id}>
          <p><strong>{photo.filename}</strong> · {stateLabel[photo.state]}</p>{photo.notes&&<p>{photo.notes}</p>}{photo.error&&<Notice tone="error">{photo.error}</Notice>}
          <div className="admin-form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>void execute(async()=>{if(!handle.current)return;const file=await readOfflinePhoto(handle.current,photo.id,photo.filename,photo.contentType);const url=URL.createObjectURL(file);const link=window.document.createElement("a");link.href=url;link.download=photo.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}).catch(()=>{})}>Save a copy of this photo</button>
          {unfinished(photo)&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>{
            if(!window.confirm("Stop retrying this photo upload? Its original file stays on this device. This does not remove any uploaded server photo."))return;
            void execute(async()=>{const document=current.current;if(document)await persist({...document,photos:document.photos.map(p=>p.id===photo.id?{...p,state:"discarded"}:p)});}).catch(()=>{});
          }}>Stop retrying this photo</button>}</div>
        </article>)}
        {!workspace.operations.length&&!workspace.photos.length&&<p>No saved changes or photos yet.</p>}
      </section>
      <section className="field-card admin-section"><h2>Device workspace</h2><p>Deleting a device workspace removes its local drafts and original photo copies.</p>
        <div className="admin-form-actions"><button type="button" className="secondary-button danger-button" disabled={busy} onClick={()=>{
          if(!confirmDiscardChanges()||!window.confirm(`Delete this device workspace, including ${pending} unsynchronized actions and ${workspace.photos.length} saved photo files? Server records are retained.`))return;
          void execute(async()=>{await deleteOfflineVault(workspace.id);handle.current=undefined;current.current=undefined;setWorkspace(undefined);setReview(undefined);setVaults(await listOfflineVaults());setMessage("Device workspace deleted.");}).catch(()=>{});
        }}>Delete device workspace</button></div>
      </section>
    </>}
  </main>;
}
