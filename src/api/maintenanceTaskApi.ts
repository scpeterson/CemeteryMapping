import {localTaskDate} from "./taskReminders";
export {localTaskDate} from "./taskReminders";
import {apiBaseUrl} from '../config/environment';
import {authorizedFetch,jsonRequest,jsonResponse,normalizeBaseUrl} from './apiClient';
import type {SaveMaintenanceRecordInput} from '../types';
export type MaintenanceTask={id:string;version:string;cemeteryId:string;cemeteryName:string;gravesiteUuid?:string;headstoneUuid?:string;gravesiteId?:string;markerId?:string;title:string;priority:string;status:SaveMaintenanceRecordInput['status'];observedAt:string;completedAt?:string;performedBy:string;notes:string;assignedToId?:string;assignedToName:string;assigneeActive:boolean;dueDate?:string;remindOn?:string;reminderDismissedAt?:string;overdue?:boolean;dueSoon?:boolean;reminderDue?:boolean};
export type TaskEdit={expectedVersion:string;reason:string;assignedToId:string;dueDate:string;remindOn:string;status:MaintenanceTask['status'];completedAt:string;performedBy:string;notes:string};
export type TaskFilters={cemeteryId:string;view:'mine'|'all'|'unassigned';state:'open'|'all'|'completed';attention:'all'|'overdue'|'soon'|'reminder';q:string;offset:number};
export type TaskPage={rows:MaintenanceTask[];summary:{total:number;overdue:number;reminders:number};today:string};
export type TaskChoice={id:string;label:string};
const base=normalizeBaseUrl(apiBaseUrl);
export async function fetchTaskCemeteries(q:string){return jsonResponse<{id:string;name:string}[]>(await authorizedFetch(`${base}/task-cemeteries?${new URLSearchParams({q})}`),'Task cemeteries API');}
export async function fetchTasks(filters:TaskFilters){const params=new URLSearchParams({view:filters.view,state:filters.state,attention:filters.attention,q:filters.q,offset:String(filters.offset),limit:'51',today:localTaskDate()});if(filters.cemeteryId)params.set('cemeteryId',filters.cemeteryId);return jsonResponse<TaskPage>(await authorizedFetch(`${base}/maintenance-tasks?${params}`),'Maintenance queue API');}
export async function fetchTask(id:string){return jsonResponse<MaintenanceTask>(await authorizedFetch(`${base}/maintenance-tasks/${id}`),'Maintenance task API');}
export async function fetchTaskAssignees(cemeteryId:string,q:string,selectedId?:string){const params=new URLSearchParams({q});if(selectedId)params.set('selectedId',selectedId);return jsonResponse<TaskChoice[]>(await authorizedFetch(`${base}/cemeteries/${cemeteryId}/task-assignees?${params}`),'Task assignees API');}
export async function saveTask(task:MaintenanceTask,input:TaskEdit){return jsonResponse<MaintenanceTask>(await authorizedFetch(`${base}/maintenance-tasks/${task.id}`,jsonRequest('PUT',input)),'Save maintenance task API');}
export async function createTask(cemeteryId:string,input:SaveMaintenanceRecordInput&{operationId:string;assignedToId:string;dueDate:string;remindOn:string}){return jsonResponse<MaintenanceTask>(await authorizedFetch(`${base}/cemeteries/${cemeteryId}/maintenance-tasks`,jsonRequest('POST',input)),'Create maintenance task API');}
export async function dismissTaskReminder(task:MaintenanceTask){return jsonResponse<MaintenanceTask>(await authorizedFetch(`${base}/maintenance-tasks/${task.id}/dismiss-reminder`,jsonRequest('POST',{expectedVersion:task.version,reason:'Assigned person dismissed in-app reminder'})),'Dismiss task reminder API');}
