import {apiBaseUrl} from '../config/environment';
import {authorizedFetch,jsonResponse,normalizeBaseUrl} from './apiClient';
export type ExportCemetery={id:string;name:string;canExportOwnership:boolean;canExportMaintenance:boolean};
export type ExportDataset='gravesites'|'people'|'markers'|'maintenance'|'ownership';
export async function fetchExportCemeteries(q:string){return jsonResponse<ExportCemetery[]>(await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/export-cemeteries?${new URLSearchParams({q})}`),'Export cemeteries API');}
export async function downloadRecords(cemeteryId:string,dataset:ExportDataset,format:'csv'|'geojson',q:string,limit:number){
 const response=await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${cemeteryId}/export?${new URLSearchParams({dataset,format,q,limit:String(limit)})}`);
 if(!response.ok)await jsonResponse(response,'Record export API');
 const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`cemetery-${dataset}.${format==='csv'?'csv':'geojson'}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return Number(response.headers.get('X-Record-Count')??0);
}
