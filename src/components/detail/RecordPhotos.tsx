import { useContext, type ComponentProps } from "react";
import type { Headstone, InspectionFace } from "../../types";
import { PhotoGalleryContext } from "./photoGalleryContext";
import type { PhotoUploadForm } from "./MediaRecords";

export function RecordPhotos({headstone,inspectionId,maintenanceRecordId,canUpdate}: {
 headstone:Headstone; faces?:InspectionFace[]; inspectionId?:string; maintenanceRecordId?:string;
 faceId?:string; canUpdate?:boolean; onUpload?:ComponentProps<typeof PhotoUploadForm>["onUpload"];
}) {
 const {open}=useContext(PhotoGalleryContext);
 return <section className="record-photos" aria-label={inspectionId?"Inspection photos":"Maintenance photos"}>
  <h5>{inspectionId?"Inspection photos":"Maintenance photos"}</h5>
  <p className="muted">{canUpdate?"View and add photos":"View photos"} in the marker gallery, with this record selected.</p>
  <button type="button" className="secondary-button" onClick={()=>open({headstone,inspectionId,maintenanceRecordId})}>Open photo gallery</button>
 </section>;
}
