import {useEffect,useState} from 'react';
import {fetchTaskAssignees,type TaskChoice} from '../../api/maintenanceTaskApi';
import {Notice} from '../ui/Feedback';
export function TaskAssigneeSelect({cemeteryId,value,currentLabel,disabled,change}:{cemeteryId:string;value:string;currentLabel?:string;disabled:boolean;change:(id:string)=>void}){
 const [query,setQuery]=useState(''),[rows,setRows]=useState<TaskChoice[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{let active=true;setLoading(true);const timer=setTimeout(()=>void fetchTaskAssignees(cemeteryId,query,value||undefined).then(data=>{if(active){setRows(data);setError('');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);}),200);return()=>{active=false;clearTimeout(timer);};},[cemeteryId,query,value]);
 return <><label>Find assigned member<input type="search" maxLength={120} disabled={disabled} value={query} onChange={e=>setQuery(e.target.value)}/></label><label>Assigned member<select disabled={disabled||loading} value={value} onChange={e=>change(e.target.value)}><option value="">Unassigned</option>{value&&!rows.some(r=>r.id===value)&&<option value={value}>{currentLabel||'Current assigned member'} (review membership)</option>}{rows.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select><small>Choose an active cemetery editor. Search to find more members.</small></label>{error&&<Notice tone="error">{error}</Notice>}</>;
}
