import { createContext, type ComponentProps } from "react";
import type { Headstone } from "../../types";
import type { PhotoUploadForm, MediaGallery } from "./MediaRecords";

export type GalleryTarget = { headstone: Headstone; inspectionId?: string; maintenanceRecordId?: string; faceLabel?: string; faceId?: string; onClose?: () => void; mode?: "upload" };
export const PhotoGalleryContext = createContext<{ open: (target: GalleryTarget) => void }>({ open: () => {} });

export type GalleryPermissions = {
 canUpdate:boolean; canEditInspections:boolean; canDelete:boolean;
 onUpload:ComponentProps<typeof PhotoUploadForm>["onUpload"];
 onDelete:ComponentProps<typeof MediaGallery>["onDelete"];
 onMove:ComponentProps<typeof MediaGallery>["onMove"];
};
