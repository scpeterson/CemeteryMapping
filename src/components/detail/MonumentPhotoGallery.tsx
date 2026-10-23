import { lazy, Suspense, useState, type ReactNode } from "react";
import type { Headstone } from "../../types";
import { PhotoGalleryContext, type GalleryTarget, type GalleryPermissions } from "./photoGalleryContext";

const PhotoWorkspace = lazy(() => import("./PhotoWorkspace"));

export function MonumentPhotosProvider({headstones,children,...permissions}: GalleryPermissions & {headstones:Headstone[];children:ReactNode}) {
 const [target,setTarget]=useState<GalleryTarget>();
 const headstone=headstones.find(marker=>marker.id===target?.headstone.id) ?? target?.headstone;
 return <PhotoGalleryContext.Provider value={{open:setTarget}}>
  {children}
  {target&&headstone?<Suspense fallback={<p role="status">Opening photo gallery…</p>}><PhotoWorkspace key={headstone.id} headstone={headstone} initialTarget={target} {...permissions} onClose={()=>{target.onClose?.();setTarget(undefined);}} /></Suspense>:null}
 </PhotoGalleryContext.Provider>;
}
