import { useState } from "react";
import { Notice } from "./Feedback";


export function ConflictRecovery({ reload, disabled = false }: { reload: () => Promise<void>; disabled?: boolean }) {
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  return <div className="conflict-recovery">
    <p>Your edits are still in the form. Copy anything you want to keep before loading the latest record.</p>
    <button type="button" className="secondary-button" disabled={disabled||loading} onClick={async()=>{
      if(!window.confirm("Discard your unsaved edits and load the latest record?"))return;
      setLoading(true);setError("");
      try{await reload();}catch(e){setError(e instanceof Error?e.message:"Unable to reload the record.");}finally{setLoading(false);}
    }}>{loading?"Loading latest values…":"Reload latest values (discard edits)"}</button>
    {error&&<Notice tone="error">{error}</Notice>}
  </div>;
}
