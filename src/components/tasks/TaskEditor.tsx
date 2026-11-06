import {useState} from 'react';
import {useDraftState} from '../../hooks/useDraftState';
import {fetchTask,saveTask,localTaskDate,type MaintenanceTask,type TaskEdit} from '../../api/maintenanceTaskApi';
import {isRecordConflict} from '../../api/apiClient';
import {ConflictRecovery} from '../ui/ConflictRecovery';
import {Notice} from '../ui/Feedback';
import {TaskAssigneeSelect} from './TaskAssigneeSelect';
const formFrom=(task:MaintenanceTask):TaskEdit=>({expectedVersion:task.version,assignedToId:task.assignedToId??'',dueDate:task.dueDate??'',remindOn:task.remindOn??'',status:task.status,completedAt:task.completedAt??'',performedBy:task.performedBy??'',notes:task.notes??'',reason:''});
export function TaskEditor({task,onSaved,onCancel,onBusyChange}:{onBusyChange:(busy:boolean)=>void;task:MaintenanceTask;onSaved:()=>void;onCancel:()=>void}){
 const [baseline,setBaseline]=useState(task);
 const [form,setForm]=useDraftState(()=>formFrom(task)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false);
 return <section className="field-card admin-section"><h2>Edit {task.title||'maintenance task'}</h2><p>{task.cemeteryName} · {task.gravesiteId||task.markerId}</p><form className="admin-form" onSubmit={e=>{e.preventDefault();if(busy)return;setBusy(true);onBusyChange(true);setError('');setConflict(false);void saveTask(task,form).then(()=>{setForm(form);onSaved();}).catch(e=>{setConflict(isRecordConflict(e));setError(e instanceof Error?e.message:'Unable to save task.');}).finally(()=>{setBusy(false);onBusyChange(false);});}}>
 <TaskAssigneeSelect cemeteryId={task.cemeteryId} value={form.assignedToId} currentLabel={form.assignedToId===baseline.assignedToId?baseline.assignedToName:undefined} disabled={busy} change={id=>setForm(f=>({...f,assignedToId:id}))}/>
 {!baseline.assigneeActive&&baseline.assignedToId&&<Notice>The existing assignee no longer has active editor access. Keep the history or reassign the remaining work.</Notice>}
 <label>Due date<input type="date" disabled={busy} value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))}/></label><label>Reminder date<input type="date" disabled={busy} value={form.remindOn} max={form.dueDate||undefined} onChange={e=>setForm(f=>({...f,remindOn:e.target.value}))}/></label>
 <label>Task status<select disabled={busy} value={form.status} onChange={e=>{const status=e.target.value as TaskEdit['status'];setForm(f=>({...f,status,completedAt:status==='completed'?(f.completedAt||localTaskDate()):''}));}}>{Object.entries({open:'Open',scheduled:'Scheduled',deferred:'Deferred',completed:'Completed',not_needed:'Not needed'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Completed date<input type="date" required={form.status==='completed'} disabled={busy||form.status!=='completed'} value={form.completedAt} onChange={e=>setForm(f=>({...f,completedAt:e.target.value}))}/></label>
 <label>Performed by<input disabled={busy} maxLength={200} value={form.performedBy} onChange={e=>setForm(f=>({...f,performedBy:e.target.value}))}/></label><label>Task notes<textarea rows={3} disabled={busy} maxLength={4000} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label><label className="field-wide">Task change reason<textarea required disabled={busy} maxLength={500} value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}/></label>
 {error&&<Notice tone="error">{error}</Notice>}{conflict&&<ConflictRecovery disabled={busy} reload={async()=>{const latest=await fetchTask(task.id);setForm(formFrom(latest));setBaseline(latest);setConflict(false);setError('');}}/>}
 <div className="admin-form-actions"><button type="submit" disabled={busy||!form.reason.trim()}>Save task</button><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancel task edit</button></div>
 </form></section>;
}
