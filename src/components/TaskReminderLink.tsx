import {useEffect,useState} from 'react';
import {ListChecks} from 'lucide-react';
import {fetchTaskReminderSummary} from '../api/taskReminders';
export function TaskReminderLink({accountId}:{accountId?:string}){
 const [attention,setAttention]=useState(0);
 useEffect(()=>{
  setAttention(0);if(!accountId)return;
  let generation=0;
  const refresh=async()=>{
   if(document.visibilityState==='hidden')return;
   const request=++generation;let count=0;
   try{count=(await fetchTaskReminderSummary()).attention;}catch{/* The full queue reports connection failures. */}
   if(request===generation)setAttention(count);
  };
  void refresh();window.addEventListener('focus',refresh);const timer=setInterval(refresh,60000);
  return()=>{generation++;clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[accountId]);
 return <a href="/tasks/" aria-label={attention?`Open maintenance tasks: ${attention} assigned tasks need attention`:'Open maintenance tasks'} title="Assignments and reminders"><ListChecks size={16} aria-hidden="true"/><span>Tasks{attention?` (${attention})`:''}</span></a>;
}
