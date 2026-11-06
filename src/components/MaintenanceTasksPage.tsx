import {useEffect,useState} from 'react';
import {fetchCurrentUser} from '../api/cemeteryApi';
import {fetchTaskCemeteries,fetchTasks,dismissTaskReminder,type MaintenanceTask,type TaskFilters,type TaskPage} from '../api/maintenanceTaskApi';
import type {CurrentUser} from '../types';
import {confirmDiscardChanges,useDraftNavigationGuard} from '../hooks/useDraftState';
import {Notice} from './ui/Feedback';
import {TaskEditor} from './tasks/TaskEditor';
import {NewTaskForm} from './tasks/NewTaskForm';
const labels={open:'Open',scheduled:'Scheduled',completed:'Completed',deferred:'Deferred',not_needed:'Not needed'};
export function MaintenanceTasksPage(){
 useDraftNavigationGuard();
 const [user,setUser]=useState<CurrentUser>(),[userAttempt,setUserAttempt]=useState(0),[cemeteryQuery,setCemeteryQuery]=useState(''),[cemeteries,setCemeteries]=useState<{id:string;name:string}[]>([]),[chosen,setChosen]=useState<{id:string;name:string}>();
 const [filters,setFilters]=useState<TaskFilters>({cemeteryId:'',view:'mine',state:'open',attention:'all',q:'',offset:0}),[query,setQuery]=useState(''),[refresh,setRefresh]=useState(0);
 const [data,setData]=useState<TaskPage>(),[selected,setSelected]=useState<MaintenanceTask>(),[creating,setCreating]=useState(false),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;void fetchCurrentUser().then(account=>{if(active){setFilters(f=>({...f,view:account.id?'mine':'all'}));setUser(account);setError('');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[userAttempt]);
 const canUse=user&&['admin','cemetery-admin','power-user'].includes(user.role);
 useEffect(()=>{if(!canUse)return;let active=true;const timer=setTimeout(()=>void fetchTaskCemeteries(cemeteryQuery).then(rows=>{if(active)setCemeteries(rows);}).catch(e=>{if(active)setError(e.message);}),200);return()=>{active=false;clearTimeout(timer);};},[canUse,cemeteryQuery,refresh]);
 useEffect(()=>{const timer=setTimeout(()=>setFilters(f=>f.q===query?f:{...f,q:query,offset:0}),200);return()=>clearTimeout(timer);},[query]);
 useEffect(()=>{if(!user||!canUse)return;let active=true;setLoading(true);void fetchTasks(filters).then(result=>{if(active){setData(result);setError('');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[user,canUse,filters,refresh]);
 useEffect(()=>{const tick=()=>{if(document.visibilityState!=='hidden')setRefresh(n=>n+1);};const timer=setInterval(tick,60000);window.addEventListener('focus',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick);};},[]);
 function change(patch:Partial<TaskFilters>){if(confirmDiscardChanges()){setFilters(f=>({...f,...patch,offset:0}));setSelected(undefined);setCreating(false);setMessage('');}}
 const choices=chosen&&!cemeteries.some(c=>c.id===chosen.id)?[chosen,...cemeteries]:cemeteries;
 const saved=()=>{setSelected(undefined);setCreating(false);setRefresh(n=>n+1);setMessage('Maintenance task saved.');};
 return <main className="field-workspace task-workspace"><header><h1>Maintenance tasks</h1><p>Plan cemetery work, review assigned tasks and record completion.</p><a href="/">Return to cemetery map</a></header>
 {error&&<Notice tone="error">{error}</Notice>}{message&&<Notice tone="success">{message}</Notice>}
 {!user?<section className="field-card admin-section"><Notice>Checking registered account access…</Notice>{error&&<button type="button" onClick={()=>setUserAttempt(n=>n+1)}>Retry task access</button>}</section>:!canUse?<Notice>Current cemetery editor access is required for maintenance tasks.</Notice>:<>
 {!user.id&&<Notice>Local development has no registered person identity. Use the cemetery queue; My tasks and personal reminder dismissal require a registered account.</Notice>}
 <section className="field-card admin-section"><h2>Work queue</h2><div className="admin-form">
 <label>Find task cemetery<input type="search" maxLength={120} disabled={busy} value={cemeteryQuery} onChange={e=>setCemeteryQuery(e.target.value)}/></label><label>Task cemetery<select disabled={busy} value={filters.cemeteryId} onChange={e=>{if(confirmDiscardChanges()){setChosen(choices.find(c=>c.id===e.target.value));change({cemeteryId:e.target.value});}}}><option value="">All editable cemeteries</option>{choices.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label>Task view<select disabled={busy} value={filters.view} onChange={e=>change({view:e.target.value as TaskFilters['view']})}>{user.id&&<option value="mine">My tasks</option>}<option value="all">All cemetery tasks</option><option value="unassigned">Unassigned tasks</option></select></label><label>Task state<select disabled={busy} value={filters.state} onChange={e=>change({state:e.target.value as TaskFilters['state']})}><option value="open">Open work</option><option value="completed">Completed work</option><option value="all">All states</option></select></label>
 <label>Attention filter<select disabled={busy} value={filters.attention} onChange={e=>change({attention:e.target.value as TaskFilters['attention']})}><option value="all">All dates</option><option value="overdue">Overdue</option><option value="soon">Due in the next seven days</option><option value="reminder">Reminders</option></select></label><label>Search tasks<input type="search" maxLength={120} value={query} onChange={e=>setQuery(e.target.value)}/></label>
 <p className="field-wide">Due dates and reminders use calendar dates on your device. Reminders appear here and on the Tasks button while you use the application. Completion records remain in history.</p>
 <div className="admin-form-actions"><button type="button" disabled={busy||!filters.cemeteryId} onClick={()=>{if(confirmDiscardChanges()){setSelected(undefined);setCreating(true);}}}>New maintenance task</button><button type="button" className="secondary-button" disabled={busy||loading} onClick={()=>setRefresh(n=>n+1)}>Reload tasks</button></div>
 {!filters.cemeteryId&&<p>Choose a cemetery to create a task.</p>}</div>
 </section>
 {creating&&filters.cemeteryId&&<NewTaskForm key={filters.cemeteryId} cemeteryId={filters.cemeteryId} onSaved={saved} onBusyChange={setBusy} onCancel={()=>{if(confirmDiscardChanges())setCreating(false);}}/>}
 {selected&&<TaskEditor key={`${selected.id}:${selected.version}`} task={selected} onSaved={saved} onBusyChange={setBusy} onCancel={()=>{if(confirmDiscardChanges())setSelected(undefined);}}/>}
 <section className="field-card admin-section"><h2>{filters.view==='mine'?'My assigned work':filters.view==='unassigned'?'Unassigned work':'Cemetery work'}</h2>
 {data&&<p role="status">{data.summary.total} matching tasks · {data.summary.overdue} overdue · {data.summary.reminders} reminders</p>}{loading&&<Notice>Refreshing task queue…</Notice>}
 {data?.rows.slice(0,50).map(task=><article key={task.id} className="field-change"><h3>{task.title||'Maintenance task'}</h3><p>{task.cemeteryName} · {task.gravesiteId||task.markerId} · {task.priority} · {labels[task.status]}</p><p>Assigned to {task.assignedToName}{task.assignedToId&&!task.assigneeActive?' (review current membership)':''}{task.dueDate?` · Due ${task.dueDate}`:''}</p>
 {task.overdue&&<Notice tone="error">Overdue</Notice>}{task.reminderDue&&<Notice>Reminder due {task.remindOn}</Notice>}{task.notes&&<p>{task.notes}</p>}{task.completedAt&&<p>Completed {task.completedAt}{task.performedBy?` by ${task.performedBy}`:''}</p>}
 <div className="admin-form-actions"><button type="button" disabled={busy} onClick={()=>{if(confirmDiscardChanges()){setCreating(false);setSelected(task);}}}>Edit task {task.gravesiteId||task.markerId||task.title}</button>{task.reminderDue&&task.assignedToId===user.id&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>{setBusy(true);setError('');void dismissTaskReminder(task).then(()=>{setRefresh(n=>n+1);setMessage('Reminder dismissed. Overdue work remains visible until completed or rescheduled.');}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Dismiss my reminder</button>}</div>
 </article>)}{!loading&&!data?.rows.length&&<p>No matching tasks.</p>}
 <div className="admin-form-actions"><button type="button" className="secondary-button" disabled={busy||loading||!filters.offset} onClick={()=>setFilters(f=>({...f,offset:Math.max(0,f.offset-50)}))}>Previous tasks</button><span>Page {Math.floor(filters.offset/50)+1}</span><button type="button" className="secondary-button" disabled={busy||loading||!data||data.rows.length<=50} onClick={()=>setFilters(f=>({...f,offset:f.offset+50}))}>Next tasks</button></div>
 </section></>}
 </main>;
}
