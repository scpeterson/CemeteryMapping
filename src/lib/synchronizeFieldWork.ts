import { fetchCurrentUser } from "../api/cemeteryApi";
import { synchronizeFieldAction, fetchFieldSnapshot } from "../api/fieldCollectionApi";
import { uploadHeadstonePhoto } from "../api/mediaApi";
import { ApiError, isRecordConflict } from "../api/apiClient";
import { roleForCemetery } from "./selectionPermissions";
import type { OfflineWorkspace, FieldOperation, FieldPhoto } from "./offlineFieldTypes";

export async function synchronizeFieldWork(document:OfflineWorkspace,persist:(next:OfflineWorkspace)=>Promise<OfflineWorkspace>,readPhoto:(id:string,name:string,mime:string)=>Promise<File>){
  const user=await fetchCurrentUser();
  if(user.subject!==document.ownerSubject)throw new Error("Sign in with the account used to prepare this workspace. Your device work is retained.");
  if(!["admin","cemetery-admin","power-user"].includes(roleForCemetery(user,document.cemeteryId)))throw new Error("This account no longer has edit access to this cemetery. Your device work is retained.");
  let current=document;
  for(const operation of document.operations.filter(o=>!["synced","discarded"].includes(o.state))){
    if(operation.state==="conflict")throw new Error("Review the highlighted conflict before synchronizing the remaining work.");
    current=await persist({...current,operations:current.operations.map<FieldOperation>(o=>o.id===operation.id?{...o,state:"sending",attempted:true,error:undefined}:o)});
    try{
      await synchronizeFieldAction(operation);
      current=await persist({...current,operations:current.operations.map<FieldOperation>(o=>o.id===operation.id?{...o,state:"synced",error:undefined}:o)});
    }catch(error){
      const message=error instanceof Error?error.message:"Synchronization was interrupted.";
      const errorStatus=error instanceof ApiError?error.status:undefined;
      await persist({...current,operations:current.operations.map<FieldOperation>(o=>o.id===operation.id?{...o,state:isRecordConflict(error)?"conflict":"failed",error:message,errorStatus,
        attempted:![400,413].includes(errorStatus??0)}:o)});
      throw error;
    }
  }
  for(const photo of document.photos.filter(p=>!["synced","discarded"].includes(p.state))){
    current=await persist({...current,photos:current.photos.map<FieldPhoto>(p=>p.id===photo.id?{...p,state:"sending",attempted:true,error:undefined}:p)});
    try{
      const file=await readPhoto(photo.id,photo.filename,photo.contentType);
      await uploadHeadstonePhoto({operationId:photo.id,headstoneId:photo.markerId,file,notes:photo.notes,capturedAt:photo.capturedAt||undefined,
        inspectionId:photo.inspectionId,faceId:photo.faceId,latitude:photo.latitude,longitude:photo.longitude,gpsAccuracy:photo.gpsAccuracy});
      current=await persist({...current,photos:current.photos.map<FieldPhoto>(p=>p.id===photo.id?{...p,state:"synced",error:undefined}:p)});
    }catch(error){
      const message=error instanceof Error?error.message:"Photo upload was interrupted.";
      await persist({...current,photos:current.photos.map<FieldPhoto>(p=>p.id===photo.id?{...p,state:"failed",error:message}:p)});
      throw error;
    }
  }
  // Confirmed writes are never resent. A lost local status update retries the same
  // operation ID, allowing the server receipt to acknowledge the original write.
  const records=[];
  for(const record of current.records)records.push(await fetchFieldSnapshot(current.cemeteryId,record.headstone.id));
  return persist({...current,records});
}
