import {apiBaseUrl} from "../config/environment";
import {authorizedFetch,jsonResponse,normalizeBaseUrl} from "./apiClient";
const base=normalizeBaseUrl(apiBaseUrl);
export function localTaskDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export async function fetchTaskReminderSummary(){return jsonResponse<{attention:number;overdue:number;reminders:number}>(await authorizedFetch(`${base}/maintenance-tasks/summary?${new URLSearchParams({today:localTaskDate()})}`),'Task reminders');}
