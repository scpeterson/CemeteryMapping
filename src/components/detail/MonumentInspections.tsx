import { InspectionFacePhotos, type InspectionPhotoDraft } from "./InspectionFacePhotos";
import { savePhotoContext } from "../../api/mediaApi";
import { RecordPhotos } from "./RecordPhotos";
import type { ComponentProps } from "react";
import { useState } from "react";
import { useDraftState } from "../../hooks/useDraftState";
import type { Headstone, InspectionInput, InspectionFace, LookupOption } from "../../types";
import { formatDate } from "../../lib/format";

type InspectionDraft = InspectionInput & { photos?: InspectionPhotoDraft[]; recordSaved?: boolean };

const combinedReading = (faces: InspectionFace[]) => faces.length === 1 ? faces[0].inscription : faces.map(f=>`${f.label}\n${f.inscription}`).join("\n\n");
const isCombined = (inscription: string, faces: InspectionFace[] = []) => faces.length > 0 && inscription === combinedReading(faces);
const draftFaces = (inscription: string, faces: InspectionFace[] = []): InspectionFace[] => faces.length
  ? faces.map(({id,label,inscription}) => ({id,label,inscription}))
  : [{id:crypto.randomUUID(),label:"Front",inscription}];
const inspectionTypes = { field_survey: "Field inspection", nhg: "NHG", historical: "Historical inspection" };
const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function MonumentInspections({ headstone, conditions = [], onSave, onUploadPhoto }: {
  headstone: Headstone;
  conditions?: LookupOption[];
  onUploadPhoto?: ComponentProps<typeof RecordPhotos>["onUpload"];
  onSave?: (entry: InspectionInput, updating: boolean) => Promise<Headstone>;
}) {
  const inspections = [...(headstone.inspections ?? [])].sort((a, b) =>
    (b.inspectedAt || `${b.inspectionYear}-00-00`).localeCompare(a.inspectedAt || `${a.inspectionYear}-00-00`)
    || (b.updatedAt || "").localeCompare(a.updatedAt || "") || b.id.localeCompare(a.id));
  const [selectedId, setSelectedId] = useState<string>();
  const selected = inspections.find((entry) => entry.id === selectedId) ?? inspections[0];
  const [draft, setDraft] = useDraftState<InspectionDraft | null>(null);
  const [updating, setUpdating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const change = (value: Partial<InspectionInput>) => setDraft((current) => current ? { ...current, ...value } : current);

  const changeFaces = (faces: InspectionFace[]) => {
    if (!draft) return;
    change({faces,...(isCombined(draft.inscription,draft.faces) ? {inscription:combinedReading(faces)} : {})});
  };

  const begin = (edit: boolean) => {
    setError(undefined);
    setUpdating(edit);
    setDraft(() => edit && selected ? {
      id: selected.id, inspectedAt: selected.inspectedAt ?? "", inspectionYear: selected.inspectionYear,
      sourceType: selected.sourceType, source: selected.source, conditionId: selected.conditionId,
      conditionNotes: selected.conditionNotes, inscription: selected.inscription, expectedUpdatedAt: selected.updatedAt,
      faces: draftFaces(selected.inscription, selected.faces),
    } : {
      id: crypto.randomUUID(), inspectedAt: localToday(), sourceType: "field_survey",
      source: "Cemetery administrator field inspection",
      conditionId: conditions.find((c) => c.code === "unknown")?.id ?? "",
      conditionNotes: "", inscription: selected?.inscription ?? headstone.inscription ?? "",
      faces: draftFaces(selected?.inscription ?? headstone.inscription ?? "", selected ? selected.faces : headstone.faces),
    });
  };
  const save = async () => {
    if (!draft || !onSave) return;
    setSaving(true); setError(undefined);
    try {
      if (!draft.recordSaved) {
        const entry: InspectionDraft = {...draft};
        delete entry.photos; delete entry.recordSaved;
        await onSave(entry, updating);
        setSelectedId(draft.id);
        setDraft(current=>current?{...current,recordSaved:true}:current);
      }
      const failures: string[] = [];
      for (const photo of draft.photos ?? []) {
        if (photo.saved) continue;
        try {
          if (photo.file) {
            if (!onUploadPhoto) throw new Error("Photo uploads are unavailable. The inspection has been saved.");
            await onUploadPhoto({file:photo.file,headstoneId:headstone.id,inspectionId:draft.id,faceId:photo.faceId,notes:photo.notes,capturedAt:photo.capturedAt||undefined});
          } else if (photo.mediaAssetId) {
            await savePhotoContext(headstone.id,photo.mediaAssetId,{inspectionId:draft.id,faceId:photo.faceId,phase:"unspecified"});
          }
          setDraft(current=>current?{...current,photos:current.photos?.map(p=>p.id===photo.id?{...p,saved:true}:p)}:current);
        } catch (cause) {
          const name=photo.file?.name||headstone.mediaAssets?.find(a=>a.id===photo.mediaAssetId)?.originalFilename||"Photo";
          failures.push(`${name}: ${cause instanceof Error?cause.message:"Unable to save photo."}`);
        }
      }
      if(failures.length) throw new Error(failures.join(" "));
      setSelectedId(draft.id);
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save inspection.");
    } finally { setSaving(false); }
  };

  return <section className="headstone-wide-field monument-inspections" aria-label="Inspections">
    <h4>Inspections</h4>
    {inspections.length ? <label>Inspection
      <select value={selected?.id ?? ""} disabled={Boolean(draft)} onChange={(event) => setSelectedId(event.target.value)}>
        {inspections.map((entry) => <option key={entry.id} value={entry.id}>
          {entry.inspectedAt ? formatDate(entry.inspectedAt) : `${entry.inspectionYear} (exact date unknown)`} · {inspectionTypes[entry.sourceType]} · {entry.source}
        </option>)}
      </select>
    </label> : <p className="muted">No inspections recorded.</p>}
    {selected && !draft ? <div aria-label="Selected inspection">
      <p><strong>Condition:</strong> {selected.condition}</p>
      {selected.conditionNotes ? <p className="note-box">{selected.conditionNotes}</p> : null}
      <p><strong>Source:</strong> {selected.source}</p>
      {(selected.faces ?? []).map(face => <div key={face.id}>
        <h5>{face.label}</h5>
        {face.inscription ? <p className="note-box inscription-box">{face.inscription}</p> : <p className="muted">No inscription recorded for this face.</p>}
      </div>)}
      {!isCombined(selected.inscription,selected.faces) ? <><h5>{selected.faces?.length ? "Additional / unassigned inscription" : "Inscription"}</h5>
      {selected.inscription ? <p className="note-box inscription-box">{selected.inscription}</p> : <p className="muted">No inscription recorded for this inspection.</p>}</> : null}
    </div> : null}
    {selected && !draft ? <RecordPhotos key={selected.id} headstone={headstone} faces={selected.faces ?? []} inspectionId={selected.id} canUpdate={Boolean(onSave)} onUpload={onUploadPhoto} /> : null}
    {onSave && !draft ? <div className="headstone-form-actions inspection-actions">
      <button type="button" onClick={() => begin(false)}>New inspection</button>
      {selected ? <button type="button" className="secondary-button" onClick={() => begin(true)}>Edit inspection</button> : null}
    </div> : null}
    {draft ? <fieldset className="inspection-editor" disabled={saving}>
      <legend>{updating ? "Edit inspection" : "New inspection"}</legend>
      {!updating ? <p className="muted">The inscription was copied from {selected ? "the selected inspection" : "the marker"}. Edit it or save it as-is. Photo links are not copied. Add photos under each face; they will be linked when you save.</p> : null}
      {draft.recordSaved?<div role="status">
        <p>The inspection is saved. Retry the remaining photos, or close to keep the inspection and photos already saved.</p>
        <ul>{(draft.photos??[]).map(photo=><li key={photo.id}>{photo.file?.name||headstone.mediaAssets?.find(a=>a.id===photo.mediaAssetId)?.originalFilename||"Monument photo"}: {photo.saved?"Saved and linked":"Pending"}{!photo.saved?<button type="button" className="secondary-button" onClick={()=>setDraft(current=>current?{...current,photos:current.photos?.filter(p=>p.id!==photo.id)}:current)}>Remove pending photo</button>:null}</li>)}</ul>
      </div>:null}
      <fieldset disabled={Boolean(draft.recordSaved)} className="inspection-fields">
      <label>Inspection type<select value={draft.sourceType} onChange={(e) => change({
        sourceType: e.target.value as InspectionInput["sourceType"],
        ...(e.target.value === "nhg" ? { inspectedAt: "2005-10-11", inspectionYear: 2005 } : {}),
      })}>
        <option value="field_survey">Field inspection</option><option value="nhg">NHG</option><option value="historical">Historical inspection</option>
      </select></label>
      <label>Inspection date<input type="date" value={draft.inspectedAt} disabled={draft.sourceType === "nhg"} onChange={(e) => change({ inspectedAt: e.target.value })} /></label>
      {updating && !draft.inspectedAt ? <p className="muted">Recorded year: {draft.inspectionYear}. Leave the date empty if the exact date is unknown.</p> : null}
      <label>Inspection source<input value={draft.source} maxLength={500} onChange={(e) => change({ source: e.target.value })} /></label>
      <label>Monument condition<select value={draft.conditionId} onChange={(e) => change({ conditionId: e.target.value })}>
        <option value="">Choose condition</option>{conditions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select></label>
      <label>Monument condition notes<textarea value={draft.conditionNotes} maxLength={4000} rows={3} onChange={(e) => change({ conditionNotes: e.target.value })} /></label>
      {(draft.faces ?? []).map((face,index) => <fieldset key={face.id} aria-label={`Inspection face ${index+1}`}>
        <legend>Face {index+1}</legend>
        <label>Face label<input value={face.label} maxLength={100} onChange={e=>changeFaces(draft.faces!.map(f=>f.id===face.id?{...f,label:e.target.value}:f))} /></label>
        <label>Face inscription<textarea value={face.inscription} maxLength={20000} rows={5} onChange={e=>changeFaces(draft.faces!.map(f=>f.id===face.id?{...f,inscription:e.target.value}:f))} /></label>
        {!draft.recordSaved && onUploadPhoto?<InspectionFacePhotos faceId={face.id} photos={draft.photos??[]} assets={(headstone.mediaAssets??[]).filter(a=>a.assetType==="photo")} onChange={photos=>setDraft(current=>current?{...current,photos}:current)} />:null}
      </fieldset>)}
      <button type="button" className="secondary-button" disabled={(draft.faces?.length ?? 0)>=32} onClick={()=>changeFaces([...(draft.faces ?? []),{id:crypto.randomUUID(),label:`Face ${(draft.faces?.length ?? 0)+1}`,inscription:""}])}>Add inspection face</button>
      {!isCombined(draft.inscription,draft.faces) ? <><p className="muted">Keep any reading whose face is unknown in the inspection inscription below.</p>
      <label>Inspection inscription<textarea value={draft.inscription} maxLength={20000} rows={5} onChange={(e) => change({ inscription: e.target.value })} /></label></> : <p className="muted">The combined inscription is kept in sync with these face readings.</p>}
      </fieldset>
      <div className="headstone-form-actions inspection-actions">
        <button type="button" disabled={(!draft.inspectedAt && !updating) || !draft.source.trim() || !draft.conditionId || (draft.faces ?? []).some(f=>!f.label.trim())} onClick={() => void save()}>{saving ? "Saving..." : draft.recordSaved ? (draft.photos?.some(p=>!p.saved) ? "Retry remaining photos" : "Finish inspection") : "Save inspection"}</button>
        <button type="button" className="secondary-button" onClick={() => { setDraft(null); setError(undefined); }}>{draft.recordSaved ? "Close saved inspection" : "Cancel inspection"}</button>
      </div>
    </fieldset> : null}
    {error ? <p className="detail-message is-error" role="alert">{error}</p> : null}
  </section>;
}
